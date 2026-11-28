type JobResult = "success" | "failure" | "cancelled" | "skipped";

type ReleaseOutcomeInput = {
  prepare: JobResult;
  mode: string;
  version: JobResult;
  pack: JobResult;
  publish: JobResult;
  published: string;
  verify: JobResult;
};

export function releaseOutcome(
  input: ReleaseOutcomeInput,
): "no-release" | "versioned" | "published" {
  if (input.prepare !== "success")
    throw new Error(`Release preparation ended with ${input.prepare}.`);

  if (input.mode === "none") {
    if (
      [input.version, input.pack, input.publish, input.verify].some(
        (result) => result !== "skipped",
      )
    ) {
      throw new Error("The no-release mode ran a release job.");
    }
    return "no-release";
  }

  if (input.mode === "version") {
    if (
      input.version !== "success" ||
      [input.pack, input.publish, input.verify].some((result) => result !== "skipped")
    ) {
      throw new Error("Changesets versioning did not complete cleanly.");
    }
    return "versioned";
  }

  if (input.mode === "publish") {
    if (input.version !== "skipped" || input.pack !== "success" || input.publish !== "success") {
      throw new Error("The release was not packed, published, and independently verified.");
    }
    if (input.published !== "true") {
      throw new Error(
        "Changesets did not report a new npm publication; inspect npm and repair release metadata before retrying.",
      );
    }
    if (input.verify !== "success") {
      throw new Error("The release was not packed, published, and independently verified.");
    }
    return "published";
  }

  throw new Error(`Unknown Changesets release mode: ${input.mode || "(empty)"}.`);
}

if (import.meta.main) {
  const result = releaseOutcome({
    prepare: process.env.PREPARE_RESULT as JobResult,
    mode: process.env.RELEASE_MODE ?? "",
    version: process.env.VERSION_RESULT as JobResult,
    pack: process.env.PACK_RESULT as JobResult,
    publish: process.env.PUBLISH_RESULT as JobResult,
    published: process.env.PUBLISHED ?? "",
    verify: process.env.VERIFY_RESULT as JobResult,
  });

  const messages = {
    "no-release": "No release required; no npm publication occurred.",
    versioned: "Changesets Release PR was created or updated; no npm publication occurred.",
    published: "npm publication and release metadata were independently verified.",
  };
  console.log(messages[result]);
}
