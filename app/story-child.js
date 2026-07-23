const MAX_CHILD_NAME_LENGTH = 40;
const MAX_CHILD_APPEARANCE_LENGTH = 500;

export const DEFAULT_STORY_CHILD = Object.freeze({
  name: "Sam",
  appearance: "Sam is a fictional six-year-old child with dark brown skin, springy black curls, round teal glasses, an orange-and-cream striped T-shirt, navy overalls, and yellow sneakers.",
});

export function resolveStoryChildConfig(source = {}) {
  const configuredName = normalizeConfigValue(
    source.name ?? source.STORY_CHILD_NAME,
    MAX_CHILD_NAME_LENGTH,
  );
  const name = configuredName || DEFAULT_STORY_CHILD.name;
  const configuredAppearance = normalizeConfigValue(
    source.appearance ?? source.STORY_CHILD_APPEARANCE,
    MAX_CHILD_APPEARANCE_LENGTH,
  );
  const appearance = configuredAppearance
    ? configuredAppearance.replaceAll("{name}", name)
    : DEFAULT_STORY_CHILD.appearance.replace(
      new RegExp(`^${DEFAULT_STORY_CHILD.name}\\b`, "u"),
      () => name,
    );

  return Object.freeze({ name, appearance });
}

function normalizeConfigValue(value, maximumLength) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length <= maximumLength ? normalized : "";
}
