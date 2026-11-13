// The "I agree" tick box for the Terms of Use and Privacy Notice (migration 67). Both open in a new tab.
export function TermsCheckbox({ terms, privacy, error }: { terms: string; privacy: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-start gap-3 text-[15px] text-ink">
        <input
          type="checkbox"
          name="agree"
          value="yes"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "agree-error" : undefined}
          className="mt-0.5 size-5 shrink-0 accent-ink"
        />
        <span>
          I am 18 or over, and I agree to Lawdeck’s{" "}
          <a href={terms} target="_blank" rel="noopener noreferrer">
            Terms of Use
          </a>{" "}
          and{" "}
          <a href={privacy} target="_blank" rel="noopener noreferrer">
            Privacy Notice
          </a>
          .
        </span>
      </label>
      {error && (
        <p id="agree-error" className="text-sm text-warning">
          {error}
        </p>
      )}
    </div>
  );
}
