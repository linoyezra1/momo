import mongoose from "mongoose";

const seatingTableSchema = new mongoose.Schema(
  {
    tableId: { type: String, required: true },
    label: { type: String, trim: true, default: "" },
    shape: { type: String, enum: ["round", "rect", "head"], default: "round" },
    capacity: { type: Number, min: 1, default: 10 },
    x: { type: Number, default: 40 },
    y: { type: Number, default: 40 },
    width: { type: Number, default: 96 },
    height: { type: Number, default: 96 }
  },
  { _id: false }
);

const venueElementSchema = new mongoose.Schema(
  {
    elementId: { type: String, required: true },
    type: { type: String, enum: ["stage", "dance", "dj", "bar", "pillar"], required: true },
    label: { type: String, trim: true, default: "" },
    x: { type: Number, default: 20 },
    y: { type: Number, default: 20 },
    width: { type: Number, default: 120 },
    height: { type: Number, default: 60 }
  },
  { _id: false }
);

const seatingLayoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    tables: { type: [seatingTableSchema], default: [] },
    venueElements: { type: [venueElementSchema], default: [] }
  },
  { timestamps: true }
);

export default mongoose.model("SeatingLayout", seatingLayoutSchema);
