import mongoose from "mongoose";
import { IContact } from "../models/Contact";
import { contactRepository } from "../repositories/contactRepository";
import { IdentifyResponse } from "../models/types";

/**
 * Detect whether this MongoDB deployment supports sessions/transactions.
 * Standalone servers (topology type "Single") do NOT support sessions.
 * Replica sets and mongos do.
 */
function supportsTransactions(): boolean {
    const topology = (mongoose.connection as any)?.client?.topology;
    if (!topology) return false;
    const desc = topology.description || topology.s?.description;
    if (!desc) return false;
    // "Single" = standalone, "ReplicaSetWithPrimary" / "Sharded" = supports transactions
    return desc.type !== "Single";
}

/**
 * Core identity reconciliation service.
 *
 * Business logic:
 * 1. Find all contacts matching email OR phoneNumber.
 * 2. Graph-traverse linked contacts to find the full connected group.
 * 3. Determine the true primary (earliest createdAt).
 * 4. Demote any other primaries to secondary.
 * 5. Create a new secondary if the request contains new information.
 * 6. Build and return the consolidated response.
 */
export async function identify(
    email?: string,
    phoneNumber?: string
): Promise<IdentifyResponse> {
    const canUseSession = supportsTransactions();

    if (!canUseSession) {
        // Standalone MongoDB — no session / transaction support
        return identifyCore(email, phoneNumber);
    }

    // Replica set / mongos — use a transaction
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await identifyCore(email, phoneNumber, session);
        await session.commitTransaction();
        return result;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

async function identifyCore(
    email?: string,
    phoneNumber?: string,
    session?: mongoose.ClientSession
): Promise<IdentifyResponse> {
    // ── Step 1: Find direct matches ────────────────────────────────────
    const directMatches = await contactRepository.findByEmailOrPhone(
        email,
        phoneNumber,
        session
    );

    // ── Case 1: No matches – create a new primary ─────────────────────
    if (directMatches.length === 0) {
        const newContact = await contactRepository.createContact(
            {
                email: email ?? null,
                phoneNumber: phoneNumber ?? null,
                linkPrecedence: "primary",
            },
            session
        );

        return buildResponse(newContact, []);
    }

    // ── Step 2: Graph-traverse to collect the full connected group ─────
    const allContacts = await gatherConnectedContacts(directMatches, session);

    // ── Step 3: Determine true primary (earliest createdAt) ────────────
    allContacts.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const truePrimary = allContacts[0];

    // ── Step 4: Demote any other primaries to secondary ────────────────
    for (const contact of allContacts) {
        if (
            contact.id !== truePrimary.id &&
            (contact.linkPrecedence === "primary" ||
                contact.linkedId !== truePrimary.id)
        ) {
            const updated = await contactRepository.updateContact(
                contact.id,
                {
                    linkedId: truePrimary.id,
                    linkPrecedence: "secondary",
                },
                session
            );
            if (updated) {
                contact.linkedId = updated.linkedId;
                contact.linkPrecedence = updated.linkPrecedence;
                contact.updatedAt = updated.updatedAt;
            }
        }
    }

    // ── Step 5: Create new secondary if incoming data adds new info ────
    const existingEmails = new Set(
        allContacts.map((c) => c.email).filter(Boolean)
    );
    const existingPhones = new Set(
        allContacts.map((c) => c.phoneNumber).filter(Boolean)
    );

    const hasNewEmail = email ? !existingEmails.has(email) : false;
    const hasNewPhone = phoneNumber ? !existingPhones.has(phoneNumber) : false;

    if (hasNewEmail || hasNewPhone) {
        const newSecondary = await contactRepository.createContact(
            {
                email: email ?? null,
                phoneNumber: phoneNumber ?? null,
                linkedId: truePrimary.id,
                linkPrecedence: "secondary",
            },
            session
        );
        allContacts.push(newSecondary);
    }

    // ── Step 6: Build response ─────────────────────────────────────────
    const secondaries = allContacts.filter(
        (c) => c.id !== truePrimary.id
    );

    return buildResponse(truePrimary, secondaries);
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * BFS / iterative expansion to collect every contact transitively linked
 * to the initial set of direct matches.
 */
async function gatherConnectedContacts(
    seed: IContact[],
    session?: mongoose.ClientSession
): Promise<IContact[]> {
    const visited = new Map<number, IContact>();

    const queue: IContact[] = [...seed];
    for (const c of seed) {
        visited.set(c.id, c);
    }

    while (queue.length > 0) {
        const current = queue.shift()!;

        // If this contact has a linkedId we haven't visited, fetch it
        if (current.linkedId && !visited.has(current.linkedId)) {
            const parents = await contactRepository.findByIds(
                [current.linkedId],
                session
            );
            for (const p of parents) {
                if (!visited.has(p.id)) {
                    visited.set(p.id, p);
                    queue.push(p);
                }
            }
        }

        // Fetch all contacts that point to this contact's ID
        const children = await contactRepository.findByLinkedIds(
            [current.id],
            session
        );
        for (const child of children) {
            if (!visited.has(child.id)) {
                visited.set(child.id, child);
                queue.push(child);
            }
        }
    }

    return Array.from(visited.values());
}

/**
 * Build the standard IdentifyResponse from a primary and its secondaries.
 */
function buildResponse(
    primary: IContact,
    secondaries: IContact[]
): IdentifyResponse {
    const emails: string[] = [];
    const phoneNumbers: string[] = [];

    if (primary.email) emails.push(primary.email);
    if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

    const emailSet = new Set(emails);
    const phoneSet = new Set(phoneNumbers);

    // Sort secondaries by createdAt for deterministic ordering
    const sorted = [...secondaries].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    for (const s of sorted) {
        if (s.email && !emailSet.has(s.email)) {
            emails.push(s.email);
            emailSet.add(s.email);
        }
        if (s.phoneNumber && !phoneSet.has(s.phoneNumber)) {
            phoneNumbers.push(s.phoneNumber);
            phoneSet.add(s.phoneNumber);
        }
    }

    return {
        contact: {
            primaryContactId: primary.id,
            emails,
            phoneNumbers,
            secondaryContactIds: sorted.map((s) => s.id),
        },
    };
}
