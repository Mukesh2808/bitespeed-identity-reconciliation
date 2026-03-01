import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContact extends Document {
    id: number;
    phoneNumber: string | null;
    email: string | null;
    linkedId: number | null;
    linkPrecedence: "primary" | "secondary";
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

// ── Auto-incrementing ID counter ──────────────────────────────────────
const counterSchema = new Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

async function getNextId(): Promise<number> {
    const counter = await Counter.findByIdAndUpdate(
        "contactId",
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}

// ── Contact schema ────────────────────────────────────────────────────
const contactSchema = new Schema<IContact>(
    {
        id: { type: Number, unique: true },
        phoneNumber: { type: String, default: null },
        email: { type: String, default: null },
        linkedId: { type: Number, default: null },
        linkPrecedence: {
            type: String,
            enum: ["primary", "secondary"],
            default: "primary",
        },
        deletedAt: { type: Date, default: null },
    },
    {
        timestamps: true, // auto createdAt & updatedAt
    }
);

contactSchema.index({ email: 1 });
contactSchema.index({ phoneNumber: 1 });
contactSchema.index({ linkedId: 1 });

// Auto-assign incrementing `id` before save
contactSchema.pre("save", async function (next) {
    if (this.isNew) {
        this.id = await getNextId();
    }
    next();
});

const ContactModel: Model<IContact> = mongoose.model<IContact>(
    "Contact",
    contactSchema
);

export default ContactModel;
