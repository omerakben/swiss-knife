// The batch-1 gold few-shot pairs. One artifact, three jobs: the in-prompt
// example, the starter chip input it mirrors, and the bench's reference output.
//
// Quick-action gold is authored as { inputs, output } — the few-shot input is
// derived by running the action's own buildPrompt over `inputs`, so it mirrors
// the real runtime input by construction. Outputs use ONLY what their input
// gives (no invented names/numbers/dates) so the few-shot teaches the house
// rules by example. Email gold has no buildPrompt, so it carries the input text.
import type { FewShot, GoldPair } from "./spec";

export const REPLY_TO_MESSAGE_GOLD: GoldPair[] = [
  {
    inputs: {
      message:
        "Hi! We'd love to have you join the school bake sale committee. Our first meeting is this Wednesday at 6pm in the library. Can you make it?",
      intent: "happy to help but I can't do Wednesdays, ask if there's another day",
    },
    output:
      "Hi! I'd love to help with the bake sale committee — thank you for thinking of me. Wednesdays are tricky for me, though. Is there another day that tends to work for the group?",
  },
  {
    inputs: {
      message: "Are we still on for our call tomorrow at 2pm?",
      intent: "yes, but I need to push it to 3pm — apologize for the short notice",
    },
    output:
      "Yes, we're still on! Could we push it to 3pm instead of 2? Sorry for the short notice, and thanks for being flexible.",
  },
];

export const REPLY_TO_REVIEW_GOLD: GoldPair[] = [
  {
    inputs: {
      review:
        "Absolutely loved the cake for my daughter's birthday — beautiful and delicious. Will order again!",
      note: "",
    },
    output:
      "Thank you so much — this truly made our day! We're thrilled the cake was part of your daughter's birthday, and we'd be delighted to bake for you again whenever the next celebration comes around.",
  },
  {
    inputs: {
      review:
        "Waited 40 minutes for a table even with a reservation. The food was good but the wait was frustrating.",
      note: "apologize and offer a free dessert on their next visit",
    },
    output:
      "Thank you for the kind words about the food, and I'm sorry about the wait — a reservation should mean a table is ready, and we fell short there. We'd love to make it up to you: dessert is on us on your next visit.",
  },
];

export const SUMMARIZE_GOLD: GoldPair[] = [
  {
    inputs: {
      text: "Hi team, following our review we've decided to push the launch to next month to give QA more time. Marketing should hold the announcement. Finance flagged that the vendor invoice is overdue. Please confirm your availability for a sync on Thursday and send updated timelines by end of day Friday. Thanks.",
    },
    output:
      "The launch is moving to next month to give QA more time, and marketing should hold the announcement until then. Finance flagged a vendor invoice that is overdue and needs attention. The team is asked to confirm availability for a Thursday sync and to send updated timelines by end of day Friday.\n\n- Launch pushed to next month (more QA time)\n- Hold the marketing announcement\n- Vendor invoice is overdue\n- Confirm Thursday sync availability\n- Send updated timelines by Friday EOD",
  },
  {
    inputs: {
      text: "Researchers found that short, frequent breaks during focused work improved retention more than one long break. The effect was strongest for complex material and weakest for routine tasks. They recommend a five-minute pause roughly every half hour, away from screens.",
    },
    output:
      "Short, frequent breaks during focused work improved retention more than a single long break. The benefit was largest for complex material and smallest for routine tasks. The researchers recommend a roughly five-minute pause every half hour, away from screens.\n\n- Frequent short breaks beat one long break for retention\n- Strongest effect on complex work, weakest on routine tasks\n- Suggested: ~5 minutes off every 30 minutes, screen-free",
  },
];

export const PLAN_WEEK_GOLD: GoldPair[] = [
  {
    inputs: {
      plate:
        "finish the proposal, dentist on Tuesday, kids' recital Thursday, taxes due Friday, hit the gym, call mom, grocery shop, fix the leaky tap",
    },
    output:
      "Must do\n- Finish the proposal\n- Dentist (Tuesday)\n- Kids' recital (Thursday)\n- Taxes (due Friday)\n\nShould do\n- Grocery shop\n- Fix the leaky tap\n- Call mom\n\nCan wait\n- Hit the gym\n\nSensible order: get the proposal done early in the week, work errands and the tap around Tuesday's dentist, and keep Thursday clear for the recital. Do the taxes Thursday or Friday morning so they're not last-minute.",
  },
  {
    inputs: {
      plate:
        "finalize the deck, dry-run the demo, send invites, prep the FAQ, line up support coverage, write the announcement, brief the team",
    },
    output:
      "Must do\n- Finalize the deck\n- Dry-run the demo\n- Write the announcement\n- Brief the team\n\nShould do\n- Send invites\n- Prep the FAQ\n- Line up support coverage\n\nCan wait\n- (it's launch week — keep everything above on track)\n\nSensible order: finalize the deck first so the demo dry-run and announcement build on it, brief the team mid-week, then send invites and prep the FAQ once the message is locked. Confirm support coverage before launch day.",
  },
];

// Email has no buildPrompt; its few-shot input is the route's user message text.
export const EMAIL_GOLD: FewShot[] = [
  {
    input:
      `Intent / notes for the email:\nPolitely remind a client their invoice (#1042, $1,200) is two weeks overdue, and ask when I can expect payment.`,
    output:
      "Subject: Invoice #1042 — a quick payment reminder\n\nHello,\n\nI hope you're doing well. I wanted to check in on invoice #1042 for $1,200, which is now about two weeks overdue. Could you let me know when I can expect payment? I'm happy to resend the invoice if that's helpful.\n\nThank you,\n[your name]",
  },
  {
    input:
      `Intent / notes for the email:\nTurn down an invitation to speak at an event because I'm fully booked that month, but offer to help another time.`,
    output:
      "Subject: Thank you for the invitation\n\nHello,\n\nThank you so much for thinking of me to speak at your event — it genuinely means a lot. Unfortunately my calendar is full that month, so I won't be able to take it on this time. I'd welcome the chance to help in the future, though, so please do keep me in mind for a later date.\n\nWith thanks,\n[your name]",
  },
];
