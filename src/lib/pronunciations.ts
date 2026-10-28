import data from "@/templates/pronunciations.json";
import { pronunciationFileSchema } from "@/schemas/voice";
import type { Pronunciation } from "./speech";

// The pronunciation list, checked against its schema when the app starts.
export const PRONUNCIATIONS: Pronunciation[] = pronunciationFileSchema.parse(data).names;
