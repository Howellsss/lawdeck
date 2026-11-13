import { POLICY_CONTACT_EMAIL as EMAIL, type Policy } from "./types";

// Lawdeck's Privacy Notice, written from what Lawdeck actually does (docs/specs). Keep it true:
// when a feature changes what is collected or who receives it, change this text in the same pull
// request and update `updated`.
export const PRIVACY_NOTICE: Policy = {
  title: "Privacy Notice",
  updated: "2026-11-13",
  intro: [
    "Lawdeck (mylawdeck.com) is an AI study and drafting workspace for Nigerian law students, Law School students and young lawyers. This notice explains, in plain words, what personal data Lawdeck collects, why, who it is shared with, how long it is kept, and the rights you have.",
    "Lawdeck is run from Nigeria and follows the Nigeria Data Protection Act 2023 (NDPA) and the rules of the Nigeria Data Protection Commission (NDPC). For this notice, Lawdeck is the data controller of your personal data.",
  ],
  sections: [
    {
      id: "summary",
      heading: "1. The short version",
      blocks: [
        {
          list: [
            "We collect what we need to run your account and give you answers: your name, email, what you ask and what you upload.",
            "Your work is private to you. Every part of Lawdeck's database is locked so that one student can never see another student's notes, chats or files.",
            "Your questions and uploads are sent to our AI providers only to produce your answers. Your name, email, phone number and payment details are never sent to the AI.",
            "We do not sell your data and we do not use it for advertising.",
            "You can delete your account at any time from your Account page. Deletion is immediate.",
          ],
        },
      ],
    },
    {
      id: "what-we-collect",
      heading: "2. What we collect",
      blocks: [
        "Account details. Your name, email address and password when you sign up, or your name and email from Google if you use Continue with Google. Your password is stored only in scrambled (hashed) form by our database provider; nobody at Lawdeck can read it.",
        "Profile. The campus and courses you choose, and your study preferences, such as your answer level and the voice you pick for reading aloud.",
        "What you do on Lawdeck. The questions you ask and the answers you receive, your chats and projects, documents you draft, practice answers you submit for marking, briefs, quizzes, your Study Diary, lesson marks and revision progress.",
        "Files you upload. PDF, Word documents and images (up to 25 MB each), including scanned or photographed notes. If you upload a document that contains other people's personal data, you are responsible for having the right to share it.",
        "Campus chat. To join campus chat you send a photo or PDF of your Law School ID card or admission letter and your Law School number (or, for aspirants, your university ID or final-year letter and matriculation number). Messages, files and voice notes (up to 2 minutes) you post, study groups you create or join, polls, quizzes and reports you make.",
        "Group calls. When you join a study group voice or video call, your audio and video travel live to the other people in the call. Calls are never recorded. We keep only that a call took place and how many minutes it lasted, so we can keep within the monthly minute limit.",
        "Voice. When you speak a question, your device's own speech service turns it into text (see section 5). When Lawdeck reads an answer aloud, the answer text is turned into speech by Microsoft Azure.",
        "Usage and technical data. For each AI request we record the model used, the amount of text processed, the cost and the time taken, but not the content. To stop abuse we keep a scrambled (hashed) form of your internet address for sign-in limits. We also record when files are downloaded, without the file itself.",
        "Error reports. If something breaks, a report of the error is sent to our error-tracking provider after personal data and document text have been removed.",
        "Payments. When paid plans start, payments are handled by Flutterwave. Your card details go straight to Flutterwave and never reach Lawdeck. We receive only what we need to record your plan: the plan, the amount, the date and a payment reference.",
        "Messages to us. If you report a problem, ask for material to be removed, or email us, we keep what you send.",
      ],
    },
    {
      id: "why",
      heading: "3. Why we use it, and our lawful basis",
      blocks: [
        "Under the NDPA, every use of personal data needs a lawful basis. Ours are:",
        {
          list: [
            "To create and run your account and give you the service you asked for (answers, drafting, practice, voice, campus chat): performance of our contract with you.",
            "To check your Law School or university identity before you join campus chat, so that only real students are in it: your consent, which you give when you send your document. You can withdraw it by leaving chat.",
            "To keep Lawdeck safe and fair (sign-in limits, abuse checks, moderation of reports, unusual-download checks, error reports): our legitimate interest in protecting students and the service.",
            "To improve the quality of answers, using records of costs, errors and the problems you report: our legitimate interest. We do not train AI models on your content.",
            "To keep payment and tax records once paid plans start, and to respond to lawful requests: legal obligation.",
          ],
        },
        "We will not use your data for a new purpose that does not fit these without telling you first, and, where the law requires, asking for your consent.",
      ],
    },
    {
      id: "ai",
      heading: "4. How the AI uses your data",
      blocks: [
        "To answer a question, Lawdeck first searches its reviewed library (and your own uploads, if you have chosen to use them). It then sends your question, the relevant passages and the recent part of your conversation to the AI model, which writes the answer.",
        {
          list: [
            "Names, email addresses and phone numbers are removed from what is sent to the AI. In voice mode, Lawdeck may greet you by your first name; that greeting is written by Lawdeck itself, is spoken by Azure, and your name is never sent to the AI model.",
            "Our AI providers process your content only to produce your answer, under their business terms, and do not use it to train their models.",
            "AI answers can be wrong. Lawdeck checks the authorities an answer cites against its library and removes any it cannot match, but you should always check important points against the sources shown.",
          ],
        },
      ],
    },
    {
      id: "sharing",
      heading: "5. Who we share it with",
      blocks: [
        "We share personal data only with the service providers that run Lawdeck for us. Each one may use it only to provide its service to Lawdeck.",
        {
          list: [
            "Supabase: our database, sign-in and file storage, hosted in the European Union.",
            "Vercel: hosts the Lawdeck website, from Dublin, Ireland.",
            "Anthropic (Claude): the AI that writes answers, marks practice answers and drafts documents (United States).",
            "Voyage AI: finds the right library passages for each question (United States).",
            "Microsoft Azure Speech: turns answer text into speech when you use Read aloud or voice mode (West Europe).",
            "LiveKit: carries live audio and video in study group calls. Nothing is recorded.",
            "Sentry: error reports, with personal data removed first.",
            "Google: Continue with Google sign-in, if you choose it. Lawdeck staff may also import library material from Google Drive.",
            "Flutterwave: payments, once paid plans start.",
            "Your device's speech service: when you tap the microphone to speak a question, your browser's built-in speech recognition (for example Google in Chrome, Apple in Safari) turns your voice into text. Lawdeck does not receive or keep the recording.",
          ],
        },
        "Other people on Lawdeck see only what you choose to share: messages and files you post in campus chat or a study group, your name as a chat member, and anything you share by link. Your private chats, notes and uploads are never visible to other students.",
        "Reviewers and administrators. A small team of reviewers can see problem reports and removal requests. Administrators can view a campus chat ID document for up to 2 minutes to approve or reject it, and can hide chat messages that break the community rules.",
        "We may also disclose data where the law requires it, for example to answer a valid court order, or to protect someone's safety. We never sell personal data.",
      ],
    },
    {
      id: "transfers",
      heading: "6. Data sent outside Nigeria",
      blocks: [
        "Lawdeck's providers store and process data outside Nigeria, mainly in the European Union, the United Kingdom and the United States. We transfer data only as Part VIII of the NDPA allows: to providers bound by contract to protect it, in countries with adequate data protection laws (such as the GDPR in the European Union) or under appropriate safeguards, and where the transfer is needed to provide the service you asked for.",
      ],
    },
    {
      id: "retention",
      heading: "7. How long we keep it",
      blocks: [
        {
          list: [
            "Your account and everything in it: for as long as your account is open. When you delete your account, it and all your chats, documents, notes and uploaded files are deleted immediately.",
            "Campus chat ID documents: deleted as soon as an administrator approves or rejects your request. We keep only the decision.",
            "Campus chat messages and files: until you delete them, the group is deleted, or your account is deleted.",
            "Download records: 30 days.",
            "Payment records, once paid plans start: as long as Nigerian tax and accounting law requires, kept separately from your study data.",
            "Problem reports and removal requests: until they are resolved, and then only as long as needed to show how they were handled.",
          ],
        },
        "Encrypted backups of the database are kept for up to 30 days to recover from failures, and are then deleted. Data you deleted can remain in a backup until that backup expires.",
      ],
    },
    {
      id: "security",
      heading: "8. How we protect it",
      blocks: [
        {
          list: [
            "Every table in Lawdeck's database has row-level security: the database itself refuses to show one student's data to another, even if our own code has a mistake.",
            "All connections are encrypted (HTTPS). Secret keys stay on our servers and never reach your browser.",
            "Uploads are checked for their real file type and size. Logs never contain document text, uploads, passwords, keys or payment data.",
            "An hourly check looks for unusual downloads, and we have a written plan for responding to a data breach. If a breach is likely to put your rights at risk, we will tell the NDPC within 72 hours of becoming aware of it and tell you without undue delay.",
          ],
        },
        "No system is completely secure. Please keep your password private and tell us at once if you think your account has been used by someone else.",
      ],
    },
    {
      id: "rights",
      heading: "9. Your rights",
      blocks: [
        "Under the NDPA you have the right to:",
        {
          list: [
            "be told how your data is used (this notice);",
            "get a copy of the personal data we hold about you;",
            "have wrong or incomplete data corrected;",
            "have your data deleted (you can delete your whole account yourself from the Account page);",
            "restrict or object to some uses, including those based on our legitimate interests;",
            "receive your data in a common, machine-readable format, and have it sent to another service where possible;",
            "withdraw your consent at any time, for example by leaving campus chat (this does not affect what was done before);",
            "not be subject to a decision based only on automated processing that has legal or similarly significant effects on you. Lawdeck's AI gives study help; it does not make decisions of that kind about you.",
          ],
        },
        `To use any of these rights, email ${EMAIL} from the email address on your account. We will reply within 30 days. If you are not satisfied with our answer, you can complain to the Nigeria Data Protection Commission (ndpc.gov.ng).`,
      ],
    },
    {
      id: "cookies",
      heading: "10. Cookies and similar technology",
      blocks: [
        "Lawdeck uses only the cookies it needs to work: sign-in cookies that keep you signed in, and a setting in your browser that remembers whether you chose light or dark mode and your chosen voice. We do not use advertising or tracking cookies.",
      ],
    },
    {
      id: "children",
      heading: "11. Age",
      blocks: [
        "Lawdeck is meant for university law students, Law School students and lawyers. You must be at least 18 years old to create an account, or have the consent of a parent or guardian if you are younger (for example, a law aspirant). If we learn that someone under 18 has an account without that consent, we will delete it.",
      ],
    },
    {
      id: "google",
      heading: "12. Google user data",
      blocks: [
        "If you use Continue with Google, Lawdeck receives your name, email address and Google account identifier from Google, only to create your account and sign you in.",
        "Lawdeck staff can import library files from Google Drive. Lawdeck then reads only the files the staff member picks, or files they paste a link to that are shared \"Anyone with the link\", only to copy them into Lawdeck's library for review. Lawdeck does not read any other Drive files, does not keep access to Drive afterwards, and does not use Google data for advertising.",
        "Lawdeck's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.",
      ],
    },
    {
      id: "changes",
      heading: "13. Changes to this notice",
      blocks: [
        "We will update this notice when Lawdeck changes what it collects or who it shares data with. The date at the top shows the latest version. If a change is significant, we will tell you in Lawdeck or by email before it takes effect.",
      ],
    },
    {
      id: "contact",
      heading: "14. Contact us",
      blocks: [
        `For any question about this notice or your personal data, email ${EMAIL}.`,
      ],
    },
  ],
};
