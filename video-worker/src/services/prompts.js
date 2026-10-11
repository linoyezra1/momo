const CLIP_SPECS = [
  {
    key: "meeting",
    duration: 5,
    template: `3D animated feature-film style, glossy stylized characters.
The man and woman from the reference image sit together in a setting inspired by: {{MEETING_CONTEXT}}.
They look at each other with shy smiles, laughing happily. Floating glowing chat bubbles drift between them.
Smooth slow camera push-in, warm indoor lighting, vertical 9:16.
Audio: soft room tone, gentle happy giggle, subtle bubble pops, sweet romantic melody.`
  },
  {
    key: "journey",
    duration: 5,
    template: `3D animated feature-film style, dynamic montage.
The couple from the reference image enjoy their moments: first experiencing {{HOBBY_1_DESC}} with high energy and laughter, then transitioning to {{HOBBY_2_DESC}}.
Vibrant colors, energetic cheerful expressions, vertical 9:16.
Audio: ambient activity sounds, wind/water whoosh, cheerful shouts, upbeat acoustic pulse.`
  },
  {
    key: "proposal",
    duration: 5,
    template: `3D animated feature-film style, warm romantic atmosphere.
Location: {{PROPOSAL_CONTEXT}}.
The man from the reference image kneels holding a sparkling diamond ring.
The woman covers her mouth in joyful shock, then leans in for a tight embrace. Silhouette guests cheering in background, vertical 9:16.
Audio: soft background murmur, sharp happy gasp, romantic string swell, warm applause and cheers.`
  },
  {
    key: "outro",
    duration: 6,
    template: `3D animated feature-film style.
The couple from the reference image holds an elegant envelope forward, smile, share a quick sweet kiss.
Then the envelope smoothly rises toward the camera, expanding until it fills the frame.
Do not render written text or a wedding invitation card. The real invitation is attached after this shot.
Vertical 9:16.
Audio: sweet romantic chime, quiet giggle at kiss, magical shimmer swell.`
  }
];

function fill(template, vars) {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => String(vars[key] || "").trim());
}

function buildClipPlans(job) {
  const vars = {
    GROOM_NAME: job.groomName,
    BRIDE_NAME: job.brideName,
    WEDDING_DATE: job.weddingDate,
    VENUE_NAME: job.venueName,
    INVITATION_IMAGE_URL: job.invitationUrl,
    COUPLE_SELFIE_URL: job.selfieUrl,
    MEETING_CONTEXT: job.story?.meeting,
    HOBBY_1_DESC: job.story?.hobby1,
    HOBBY_2_DESC: job.story?.hobby2,
    PROPOSAL_CONTEXT: job.story?.proposal
  };

  return CLIP_SPECS.map((spec) => ({
    key: spec.key,
    duration: spec.duration,
    promptText: fill(spec.template, vars),
    referenceUrls:
      spec.key === "outro"
        ? [job.selfieUrl, job.invitationUrl].filter(Boolean)
        : [job.selfieUrl].filter(Boolean)
  }));
}

module.exports = { buildClipPlans, CLIP_SPECS };
