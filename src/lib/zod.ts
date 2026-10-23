import { z } from "zod";

// Zod, set up once for the whole app. "jitless" stops Zod from testing whether the browser allows
// eval (it never needs it), which the content security policy would report or block (step 7g).
// Import z from here, never from "zod" directly (ESLint enforces this).
z.config({ jitless: true });

export { z };
