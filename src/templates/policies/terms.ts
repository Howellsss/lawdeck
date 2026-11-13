import { POLICY_CONTACT_EMAIL as EMAIL, type Policy } from "./types";

// Lawdeck's Terms of Service (also called terms of use). Keep it true to how Lawdeck works; when
// plans, payments or features change, update this text and `updated` in the same pull request.
export const TERMS_OF_SERVICE: Policy = {
  title: "Terms of Service",
  updated: "2026-11-13",
  intro: [
    "These terms (also called our Terms of Use) are the agreement between you and Lawdeck (mylawdeck.com) for using Lawdeck's website and services. Please read them. By creating an account or using Lawdeck, you agree to them. If you do not agree, please do not use Lawdeck.",
    "How we handle your personal data is explained in our Privacy Notice, which forms part of these terms.",
  ],
  sections: [
    {
      id: "what-lawdeck-is",
      heading: "1. What Lawdeck is, and what it is not",
      blocks: [
        "Lawdeck is an AI study and drafting workspace for Nigerian law students, Law School students and young lawyers. It explains topics from a reviewed library, answers and marks practice questions, helps you remember what you learn, drafts documents from reviewed templates, and lets verified students study together in campus chat.",
        {
          list: [
            "Lawdeck is a study aid. It is not a law firm and does not give legal advice. Nothing on Lawdeck creates a lawyer-client relationship. Do not rely on Lawdeck for a real legal matter; consult a qualified legal practitioner.",
            "AI can be wrong. Lawdeck answers from its reviewed library and removes authorities it cannot match, but answers, marks and drafts may still contain mistakes or be out of date. Always check important points against the sources shown and the current law.",
            "Documents drafted with Lawdeck are starting points for learning and practice. You are responsible for checking and completing any document before you use it anywhere.",
            "Lawdeck is independent. It is not affiliated with, endorsed by or connected to the Council of Legal Education, the Nigerian Law School, any university, or the Nigerian Bar Association. A mark from Lawdeck is not a prediction of any examination result.",
          ],
        },
      ],
    },
    {
      id: "accounts",
      heading: "2. Your account",
      blocks: [
        {
          list: [
            "You must be at least 18 years old, or have the consent of a parent or guardian, to create an account.",
            "Give true information when you sign up, and keep your password private. You are responsible for what happens under your account. Tell us at once if you think someone else has used it.",
            "An account is for one person. Do not share it, sell it or let others use it.",
            "You can delete your account at any time from your Account page. Deletion is immediate and cannot be undone.",
          ],
        },
      ],
    },
    {
      id: "plans",
      heading: "3. Plans, credits and payment",
      blocks: [
        "Lawdeck has a Free plan and paid plans. Each plan gives a number of credits a month; one credit is roughly one ordinary answer, and bigger jobs (such as a problem question, marking or drafting) use more. The price, credits and limits of each plan are shown on Lawdeck before you pay.",
        {
          list: [
            "Credits reset on the 1st of each month (Lagos time). Unused credits do not carry over to the next month and have no cash value.",
            "To keep Lawdeck fair, each plan also limits how many credits can be used within a few hours.",
            "Paid plans are monthly subscriptions, paid in naira through Flutterwave by card, bank transfer or USSD. Prices include any charges shown at checkout; Value Added Tax is added where the law requires.",
            "A subscription renews each month until you cancel it. You can cancel at any time; your plan then stays active until the end of the month you have paid for, and you are not charged again.",
            "Payments are not refundable once the month has started, except where Nigerian consumer law requires a refund, or where a fault on Lawdeck's side stopped you from using the service. In that case, email us within 14 days and we will put it right.",
            "We may change prices or plan features. A change to the price of your plan will be shown to you at least 14 days before it applies to your next payment, and you can cancel before then.",
            "Top-ups (extra credits), where offered, last for the period shown when you buy them and are not refundable once used.",
          ],
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "4. Using Lawdeck properly",
      blocks: [
        "You agree not to:",
        {
          list: [
            "use Lawdeck to cheat in any examination, test or assessment, or to break the rules of your university, the Nigerian Law School or any professional body;",
            "copy, scrape, download in bulk, resell or republish Lawdeck's library, lessons, memory aids, templates or answers, or use them to build another product or to train an AI model;",
            "upload anything you do not have the right to share, or anything unlawful, defamatory, obscene or that invades someone's privacy;",
            "try to get around credit limits, security, privacy rules or moderation, or access another person's account or data;",
            "attack, overload or interfere with Lawdeck, or use automated tools to access it except as Lawdeck allows;",
            "impersonate anyone, or give false identity documents.",
          ],
        },
        "We may limit, suspend or close an account that breaks these terms, after warning you where that is reasonable. In serious cases (such as fake identity documents, harassment or attacks on Lawdeck) we may act at once.",
      ],
    },
    {
      id: "campus-chat",
      heading: "5. Campus chat, study groups and calls",
      blocks: [
        {
          list: [
            "Campus chat is for verified students only. To join, you send your Law School ID or admission letter (or, for aspirants, your university ID or final-year letter). Lawdeck may refuse or remove access at its discretion, for example if a document does not look genuine.",
            "Chat messages are students' own words and appear without review. They are not Lawdeck's views and Lawdeck is not responsible for them. Use Report a message for anything that breaks the community rules.",
            "You must follow the community rules shown when you join. No harassment, hate, threats, sexual content, spam, vulgar language, sharing of exam papers you are not allowed to share, or sharing other people's personal details.",
            "Administrators may hide messages and remove people from chat. Removal from chat can be permanent.",
            "The person who creates a study group can rename it, remove members or delete it. Deleting a group deletes its messages and files for everyone.",
            "Group calls are not recorded by Lawdeck. Do not record other people without their permission. Each month has a total minute limit for calls.",
          ],
        },
      ],
    },
    {
      id: "your-content",
      heading: "6. Your content",
      blocks: [
        "You keep ownership of what you upload and write on Lawdeck: your notes, files, questions, practice answers and chat messages. You give Lawdeck a limited permission to store, copy and process that content only to provide the service to you (and, for chat, to the people you share it with), including sending it to our service providers as described in the Privacy Notice. This permission ends when you delete the content or your account, except for content you shared with others in chat, which stays until the group or message is deleted.",
        "You are responsible for your content and confirm you have the right to upload it.",
      ],
    },
    {
      id: "our-content",
      heading: "7. Lawdeck's content",
      blocks: [
        "Lawdeck's software, design, name and logo, and its library, lessons, memory aids, stories, templates, marking guides and the answers it generates are owned by Lawdeck or its licensors and protected by law. You may use them for your own personal study and practice. You may quote short parts with credit to Lawdeck. Anything more needs our written permission.",
        "Statutes and court rules belong to the public. Quotes from other library material are kept short, and full source files are never available to download.",
        "If you believe material on Lawdeck infringes your rights or is about you and should not be there, use Request removal at mylawdeck.com/takedown. We act within 7 days.",
      ],
    },
    {
      id: "availability",
      heading: "8. Changes to the service",
      blocks: [
        "We are always improving Lawdeck, so features may be added, changed or removed. We aim to keep Lawdeck available at all times, but it may sometimes be unavailable, for example for maintenance or because of a provider's outage. If a change takes away a main feature of a paid plan you are using, you can cancel and we will refund the unused part of that month.",
      ],
    },
    {
      id: "liability",
      heading: "9. Our responsibility to you",
      blocks: [
        "Lawdeck is provided with reasonable care and skill. Apart from that, and to the extent the law allows, it is provided \"as is\": we do not promise that it will be free of errors or meet every need, or that using it will lead to any examination result.",
        "To the extent the law allows, Lawdeck is not responsible for indirect or consequential loss, for loss caused by relying on an answer, mark or draft without checking it, or for events outside our reasonable control. Our total responsibility to you for any claim is limited to the amount you paid Lawdeck in the 12 months before the claim, or ₦10,000 if that is more.",
        "Nothing in these terms limits any right you have under Nigerian law that cannot be limited, including under the Federal Competition and Consumer Protection Act 2018, or our responsibility for fraud or for death or personal injury caused by our negligence.",
      ],
    },
    {
      id: "ending",
      heading: "10. Ending these terms",
      blocks: [
        "You can stop using Lawdeck and delete your account at any time. We may end these terms or close your account if you seriously or repeatedly break them, or if we stop offering Lawdeck; if we stop offering Lawdeck, we will give you at least 30 days' notice and refund the unused part of any paid month.",
      ],
    },
    {
      id: "law",
      heading: "11. Law and disputes",
      blocks: [
        "These terms are governed by the laws of the Federal Republic of Nigeria. If you have a complaint, please email us first and we will try to resolve it within 30 days. If we cannot, the dispute may be taken to the courts of Lagos State, Nigeria, without affecting your right to use any consumer protection body or court available to you by law.",
      ],
    },
    {
      id: "changes",
      heading: "12. Changes to these terms",
      blocks: [
        "We may update these terms as Lawdeck changes. The date at the top shows the latest version. If a change is significant, we will tell you in Lawdeck or by email at least 14 days before it takes effect. If you keep using Lawdeck after that, the new terms apply; if you do not agree, you can delete your account.",
      ],
    },
    {
      id: "contact",
      heading: "13. Contact us",
      blocks: [`Questions about these terms: email ${EMAIL}.`],
    },
  ],
};
