import { Schema, model } from "mongoose";

const auditSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      maxlength: 80,
    },
    resourceType: {
      type: String,
      enum: ["product", "variant", "order"],
      required: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

auditSchema.index({
  createdAt: -1,
  _id: -1,
});

auditSchema.index({
  resourceType: 1,
  resourceId: 1,
  createdAt: -1,
});

export const AdminAudit = model("AdminAudit", auditSchema);
