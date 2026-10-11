const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");

const WIDTH = 720;
const HEIGHT = 1280;
const STILL_SECONDS = 3.5;
const WHATSAPP_LIMIT_BYTES = 3 * 1024 * 1024;

function saveCommand(command, output) {
  return new Promise((resolve, reject) => {
    command.on("end", () => resolve()).on("error", (error) => reject(error)).save(output);
  });
}

async function downloadTo(url, filePath) {
  const response = await axios.get(url, { responseType: "arraybuffer", timeout: 120000 });
  fs.writeFileSync(filePath, Buffer.from(response.data));
}

function hasAudio(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve((data.streams || []).some((stream) => stream.codec_type === "audio"));
    });
  });
}

const SCALE = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24`;

function normalizeClip(input, output, withAudio) {
  const command = ffmpeg(input);
  if (!withAudio) {
    command.input("anullsrc=channel_layout=stereo:sample_rate=44100").inputFormat("lavfi");
  }
  command.outputOptions([
    "-vf",
    SCALE,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-shortest"
  ]);
  return saveCommand(command, output);
}

function renderInvitationStill(imagePath, output) {
  const command = ffmpeg(imagePath)
    .inputOptions(["-loop", "1"])
    .input("anullsrc=channel_layout=stereo:sample_rate=44100")
    .inputFormat("lavfi")
    .outputOptions([
      "-vf",
      SCALE,
      "-t",
      String(STILL_SECONDS),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-shortest"
    ]);
  return saveCommand(command, output);
}

function compressForWhatsApp(listFile, output, { crf = "26", maxrate = "900k" } = {}) {
  const command = ffmpeg(listFile).inputOptions(["-f", "concat", "-safe", "0"]).outputOptions([
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    crf,
    "-maxrate",
    maxrate,
    "-bufsize",
    "1800k",
    "-r",
    "24",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-movflags",
    "+faststart"
  ]);
  return saveCommand(command, output);
}

/**
 * Download the rendered clips plus the invitation still, then write final_video.mp4.
 * Returns the file path and a cleanup for the temp directory.
 */
async function createFinalVideo({ clipUrls, invitationUrl } = {}) {
  const urls = (Array.isArray(clipUrls) ? clipUrls : []).map((url) => String(url || "").trim()).filter(Boolean);
  const invite = String(invitationUrl || "").trim();
  if (!urls.length) throw new Error("clip_urls_missing");
  if (!invite) throw new Error("invitation_url_missing");

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "momo-intro-"));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });

  try {
    const parts = [];
    for (let index = 0; index < urls.length; index += 1) {
      const raw = path.join(dir, `raw-${index}.mp4`);
      const normalized = path.join(dir, `part-${index}.mp4`);
      await downloadTo(urls[index], raw);
      await normalizeClip(raw, normalized, await hasAudio(raw));
      parts.push(normalized);
    }

    const inviteSource = path.join(dir, "invitation-source");
    const inviteClip = path.join(dir, "invitation.mp4");
    await downloadTo(invite, inviteSource);
    await renderInvitationStill(inviteSource, inviteClip);
    parts.push(inviteClip);

    const listPath = path.join(dir, "list.txt");
    fs.writeFileSync(
      listPath,
      parts.map((file) => `file '${file.replace(/\\/g, "/")}'`).join("\n")
    );

    const finalPath = path.join(dir, "final_video.mp4");
    await compressForWhatsApp(listPath, finalPath);
    if (fs.statSync(finalPath).size > WHATSAPP_LIMIT_BYTES) {
      await compressForWhatsApp(listPath, finalPath, { crf: "32", maxrate: "500k" });
    }
    return { finalPath, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

module.exports = { createFinalVideo };
