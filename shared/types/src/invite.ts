import { z } from "zod";
import { ProfileType } from "./project.js";

// ---------- Invite status ----------

export const InviteStatus = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
]);
export type InviteStatus = z.infer<typeof InviteStatus>;

// ---------- CreateInviteInput (POST /projects/:id/invites body) ----------

export const CreateInviteInput = z.object({
  inviteeEmail: z.string().email(),
  suggestedProfile: ProfileType,
});
export type CreateInviteInput = z.infer<typeof CreateInviteInput>;

// ---------- InviteDetails (GET /invites/:token response) ----------

export const InviteDetails = z.object({
  inviteId: z.string().uuid(),
  projectId: z.string().uuid(),
  projectName: z.string(),
  invitedByName: z.string(),
  inviteeEmail: z.string().email(),
  suggestedProfile: ProfileType,
  status: InviteStatus,
  // true when inviteeEmail has no User yet — the frontend uses it to show the
  // sign-up form before the guest can accept.
  isNewUser: z.boolean(),
  expiresAt: z.string().datetime(),
});
export type InviteDetails = z.infer<typeof InviteDetails>;
