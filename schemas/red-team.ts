import { z } from "zod";

const NonEmptyString = z.string().trim().min(1);

export const RedTeamReviewSchema = z.object({
  weakest_claims: z.array(NonEmptyString).max(3),
  revised_change_my_mind_conditions: z.array(NonEmptyString).min(2).max(4),
  revised_watchlist: z.array(NonEmptyString).min(4).max(5),
  revised_bottom_line: NonEmptyString,
});
