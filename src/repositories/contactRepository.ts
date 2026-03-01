import ContactModel, { IContact } from "../models/Contact";
import { ClientSession } from "mongoose";

export class ContactRepository {
    /**
     * Find all non-deleted contacts matching email OR phoneNumber.
     */
    async findByEmailOrPhone(
        email?: string,
        phoneNumber?: string,
        session?: ClientSession
    ): Promise<IContact[]> {
        const orConditions: Record<string, string>[] = [];

        if (email) orConditions.push({ email });
        if (phoneNumber) orConditions.push({ phoneNumber });

        if (orConditions.length === 0) return [];

        const query = ContactModel.find({
            $or: orConditions,
            deletedAt: null,
        }).sort({ createdAt: 1 });

        if (session) query.session(session);
        return query.exec();
    }

    /**
     * Fetch contacts by an array of numeric IDs (non-deleted).
     */
    async findByIds(
        ids: number[],
        session?: ClientSession
    ): Promise<IContact[]> {
        if (ids.length === 0) return [];
        const query = ContactModel.find({
            id: { $in: ids },
            deletedAt: null,
        }).sort({ createdAt: 1 });

        if (session) query.session(session);
        return query.exec();
    }

    /**
     * Fetch all non-deleted contacts whose linkedId is one of the given IDs.
     */
    async findByLinkedIds(
        linkedIds: number[],
        session?: ClientSession
    ): Promise<IContact[]> {
        if (linkedIds.length === 0) return [];
        const query = ContactModel.find({
            linkedId: { $in: linkedIds },
            deletedAt: null,
        }).sort({ createdAt: 1 });

        if (session) query.session(session);
        return query.exec();
    }

    /**
     * Create a new Contact document.
     */
    async createContact(
        data: {
            email?: string | null;
            phoneNumber?: string | null;
            linkedId?: number | null;
            linkPrecedence: "primary" | "secondary";
        },
        session?: ClientSession
    ): Promise<IContact> {
        const doc = new ContactModel({
            email: data.email ?? null,
            phoneNumber: data.phoneNumber ?? null,
            linkedId: data.linkedId ?? null,
            linkPrecedence: data.linkPrecedence,
        });

        return doc.save({ session });
    }

    /**
     * Update linkedId and linkPrecedence of a contact.
     */
    async updateContact(
        id: number,
        data: {
            linkedId: number;
            linkPrecedence: "primary" | "secondary";
        },
        session?: ClientSession
    ): Promise<IContact | null> {
        return ContactModel.findOneAndUpdate(
            { id },
            {
                $set: {
                    linkedId: data.linkedId,
                    linkPrecedence: data.linkPrecedence,
                },
            },
            { new: true, session }
        ).exec();
    }
}

export const contactRepository = new ContactRepository();
