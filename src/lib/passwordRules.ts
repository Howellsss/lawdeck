// Password rules from Engineering Rules C-03: at least 10 characters.
// 72 is the longest password Supabase Auth accepts. Kept here (not in the Zod schema)
// so screens can show the rule without loading the validation library.
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;
