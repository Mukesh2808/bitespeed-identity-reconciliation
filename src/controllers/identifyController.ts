import { Request, Response, NextFunction } from "express";
import { identify } from "../services/identifyService";
import { IdentifyRequest } from "../models/types";

export async function identifyController(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const { email, phoneNumber } = req.body as IdentifyRequest;

        // Validate: at least one field must be present
        if (!email && !phoneNumber) {
            res.status(400).json({
                error: "At least one of 'email' or 'phoneNumber' must be provided.",
            });
            return;
        }

        // Normalise inputs (trim whitespace, treat empty strings as undefined)
        const normEmail = email?.trim() || undefined;
        const normPhone = phoneNumber?.toString().trim() || undefined;

        const result = await identify(normEmail, normPhone);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}
