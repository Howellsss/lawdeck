import deedOfAssignment from "./documents/deed-of-assignment.json";
import listOfDocuments from "./documents/list-of-documents.json";
import listOfWitnesses from "./documents/list-of-witnesses.json";
import motionOnNoticeWithAffidavit from "./documents/motion-on-notice-with-affidavit.json";
import preActionProtocolForm01 from "./documents/pre-action-protocol-form-01.json";
import statementOfClaim from "./documents/statement-of-claim.json";
import tenancyAgreement from "./documents/tenancy-agreement.json";
import witnessStatementOnOath from "./documents/witness-statement-on-oath.json";
import writOfSummons from "./documents/writ-of-summons.json";
import affidavitInSupportOfBail from "./documents/affidavit-in-support-of-bail.json";
import applicationForChangeOfName from "./documents/application-for-change-of-name.json";
import applicationForCorporateSearch from "./documents/application-for-corporate-search.json";
import arbitrationClause from "./documents/arbitration-clause.json";
import billOfCharges from "./documents/bill-of-charges.json";
import certificateElectronicEvidence from "./documents/certificate-electronic-evidence.json";
import chargeHighCourt from "./documents/charge-high-court.json";
import consentToFileInformation from "./documents/consent-to-file-information.json";
import corporateSearchReport from "./documents/corporate-search-report.json";
import criminalNoticeOfAppeal from "./documents/criminal-notice-of-appeal.json";
import curriculumVitae from "./documents/curriculum-vitae.json";
import directorResignationLetter from "./documents/director-resignation-letter.json";
import internalMemorandum from "./documents/internal-memorandum.json";
import legalAidApplication from "./documents/legal-aid-application.json";
import legalOpinion from "./documents/legal-opinion.json";
import letterClosingFile from "./documents/letter-closing-file.json";
import letterConfirmingInstructions from "./documents/letter-confirming-instructions.json";
import letterForAdjournment from "./documents/letter-for-adjournment.json";
import letterOfAllotment from "./documents/letter-of-allotment.json";
import memorandumOfAssociationShares from "./documents/memorandum-of-association-shares.json";
import motionOnNoticeForBail from "./documents/motion-on-notice-for-bail.json";
import noticeOfAnnualGeneralMeeting from "./documents/notice-of-annual-general-meeting.json";
import noticeOfBoardMeeting from "./documents/notice-of-board-meeting.json";
import noticeOfExtraordinaryGeneralMeeting from "./documents/notice-of-extraordinary-general-meeting.json";
import petitionForWindingUp from "./documents/petition-for-winding-up.json";
import policeBailApplication from "./documents/police-bail-application.json";
import resolutionAppointingDirector from "./documents/resolution-appointing-director.json";
import resolutionIncreaseShareCapital from "./documents/resolution-increase-share-capital.json";
import specialResolutionChangeOfName from "./documents/special-resolution-change-of-name.json";
import specialResolutionReRegistrationPublic from "./documents/special-resolution-re-registration-public.json";
import specialResolutionVoluntaryWindingUp from "./documents/special-resolution-voluntary-winding-up.json";
import statutoryLetterOfDemand from "./documents/statutory-letter-of-demand.json";
import summonsForBail from "./documents/summons-for-bail.json";
import federalHighCourt from "./forums/federal-high-court.json";
import fctHighCourt from "./forums/fct-high-court.json";
import lagosHighCourt from "./forums/lagos-high-court.json";
import lagosLandsRegistry from "./forums/lagos-lands-registry.json";

// The drafting data files (rule H-03). Reviewers load them on /admin/templates, where each is
// checked against src/schemas/drafting.ts and stays a draft until a reviewer approves it.
// Add a new file here when you add it to forums/ or documents/.
export const FORUM_FILES: unknown[] = [
  lagosHighCourt,
  fctHighCourt,
  federalHighCourt,
  lagosLandsRegistry,
];

// Document templates (step 5g), drafted from the prescribed forms and drafts in the knowledge base.
// They load as drafts; students see one only after the legal reviewer approves it.
export const TEMPLATE_FILES: unknown[] = [
  writOfSummons,
  statementOfClaim,
  motionOnNoticeWithAffidavit,
  deedOfAssignment,
  tenancyAgreement,
  // The Lagos front-loading documents that go with a writ (step 5f).
  preActionProtocolForm01,
  listOfWitnesses,
  witnessStatementOnOath,
  listOfDocuments,
  // Criminal Litigation: from the course drafting materials in the knowledge base (2026-10-25).
  affidavitInSupportOfBail,
  certificateElectronicEvidence,
  chargeHighCourt,
  consentToFileInformation,
  criminalNoticeOfAppeal,
  legalAidApplication,
  motionOnNoticeForBail,
  policeBailApplication,
  summonsForBail,
  // Corporate Law Practice: from the course drafting materials in the knowledge base (2026-10-25).
  applicationForChangeOfName,
  applicationForCorporateSearch,
  corporateSearchReport,
  directorResignationLetter,
  letterOfAllotment,
  memorandumOfAssociationShares,
  noticeOfAnnualGeneralMeeting,
  noticeOfBoardMeeting,
  noticeOfExtraordinaryGeneralMeeting,
  petitionForWindingUp,
  resolutionAppointingDirector,
  resolutionIncreaseShareCapital,
  specialResolutionChangeOfName,
  specialResolutionReRegistrationPublic,
  specialResolutionVoluntaryWindingUp,
  statutoryLetterOfDemand,
  // Professional Ethics (Law in Practice): from the course drafting materials in the knowledge base (2026-10-25).
  arbitrationClause,
  billOfCharges,
  curriculumVitae,
  internalMemorandum,
  legalOpinion,
  letterClosingFile,
  letterConfirmingInstructions,
  letterForAdjournment,
];
