import type { Blueprint } from "../../../server/routers/scout";

interface Props {
  blueprint: Blueprint;
}

// ── Attribute tier pill ────────────────────────────────────────────────────────
function TierPill({
  label,
  color,
  bg,
  border,
}: {
  label: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border mr-1 mb-1"
      style={{
        color,
        background: bg,
        borderColor: border,
        fontFamily: "'Rajdhani', sans-serif",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor?: string;
  children: React.ReactNode;
}) {
  const color = accentColor ?? "oklch(0.75 0.22 142)";
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-0.5 h-4 rounded-full"
          style={{ background: color }}
        />
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color, fontFamily: "'Rajdhani', sans-serif" }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Playstyle row with requirements ───────────────────────────────────────────
function PlaystyleRow({
  name,
  requirements,
}: {
  name: string;
  requirements: Array<{ attr: string; val: number }>;
}) {
  return (
    <div
      className="flex flex-col gap-1 p-2.5 rounded-lg mb-2 border"
      style={{
        background: "oklch(0.14 0.015 240)",
        borderColor: "oklch(0.22 0.02 240)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-sm font-semibold"
          style={{ color: "oklch(0.90 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}
        >
          {name}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            background: "oklch(0.75 0.22 142 / 0.1)",
            color: "oklch(0.75 0.22 142)",
            fontFamily: "'Rajdhani', sans-serif",
          }}
        >
          Playstyle
        </span>
      </div>
      {requirements.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {requirements.map((req) => (
            <span
              key={req.attr}
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{
                background: "oklch(0.65 0.20 230 / 0.1)",
                borderColor: "oklch(0.65 0.20 230 / 0.3)",
                color: "oklch(0.75 0.15 230)",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {req.attr} ≥ {req.val}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ScoutingReport({ blueprint }: Props) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: "oklch(0.10 0.015 240)",
        borderColor: "oklch(0.75 0.22 142 / 0.25)",
        boxShadow: "0 0 30px oklch(0.75 0.22 142 / 0.08)",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{
          background: "oklch(0.75 0.22 142 / 0.08)",
          borderColor: "oklch(0.75 0.22 142 / 0.2)",
        }}
      >
        <div>
          <div
            className="text-xs tracking-widest uppercase mb-0.5"
            style={{ color: "oklch(0.75 0.22 142)", fontFamily: "'Rajdhani', sans-serif" }}
          >
            Scouting Blueprint
          </div>
          <div
            className="text-xl font-black"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: "oklch(0.95 0.01 240)",
              letterSpacing: "0.05em",
            }}
          >
            {blueprint.archetype.toUpperCase()}
          </div>
        </div>
        <div
          className="text-right text-xs"
          style={{ color: "oklch(0.55 0.01 240)", fontFamily: "'Inter', sans-serif" }}
        >
          <div>{blueprint.heightRange}</div>
          <div>{blueprint.weightRange}</div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 stagger-children">
        {/* Playstyle+ */}
        <Section title="Playstyle+" accentColor="oklch(0.78 0.18 85)">
          <div className="flex flex-wrap gap-2">
            {blueprint.playstylePlus.map((ps) => (
              <span key={ps} className="playstyle-plus-chip">
                <span style={{ color: "oklch(0.78 0.18 85)" }}>★</span>
                {ps}
              </span>
            ))}
          </div>
        </Section>

        {/* Specialisation */}
        {blueprint.specialisation && (
          <Section title="Specialisation" accentColor="oklch(0.70 0.15 300)">
            <div
              className="flex items-center gap-3 p-2.5 rounded-lg border"
              style={{
                background: "oklch(0.70 0.15 300 / 0.08)",
                borderColor: "oklch(0.70 0.15 300 / 0.3)",
              }}
            >
              <div>
                <div
                  className="text-sm font-bold"
                  style={{ color: "oklch(0.85 0.10 300)", fontFamily: "'Rajdhani', sans-serif" }}
                >
                  {blueprint.specialisation}
                </div>
                {blueprint.specialisationPlaystylePlus && (
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "oklch(0.65 0.08 300)" }}
                  >
                    Bonus: <span style={{ color: "oklch(0.78 0.18 85)" }}>{blueprint.specialisationPlaystylePlus}</span>
                  </div>
                )}
              </div>
              {blueprint.specialisationMinAttrs && blueprint.specialisationMinAttrs.length > 0 && (
                <div className="flex flex-wrap gap-1 ml-auto">
                  {blueprint.specialisationMinAttrs.map((req) => (
                    <span
                      key={req.attr}
                      className="text-xs px-2 py-0.5 rounded-full border"
                      style={{
                        background: "oklch(0.70 0.15 300 / 0.1)",
                        borderColor: "oklch(0.70 0.15 300 / 0.3)",
                        color: "oklch(0.75 0.10 300)",
                      }}
                    >
                      {req.attr} ≥ {req.val}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Standard Playstyles */}
        <Section title="Standard Playstyles (8)">
          {blueprint.playstyles.map((ps) => (
            <PlaystyleRow key={ps.name} name={ps.name} requirements={ps.requirements} />
          ))}
        </Section>

        {/* Attribute Tiers */}
        <Section title="Core Attributes (8)" accentColor="oklch(0.75 0.22 142)">
          <div className="flex flex-wrap">
            {blueprint.coreAttributes.map((attr) => (
              <TierPill
                key={attr}
                label={attr}
                color="oklch(0.85 0.15 142)"
                bg="oklch(0.75 0.22 142 / 0.12)"
                border="oklch(0.75 0.22 142 / 0.35)"
              />
            ))}
          </div>
        </Section>

        <Section title="Secondary Attributes (12)" accentColor="oklch(0.65 0.20 230)">
          <div className="flex flex-wrap">
            {blueprint.secondaryAttributes.map((attr) => (
              <TierPill
                key={attr}
                label={attr}
                color="oklch(0.75 0.15 230)"
                bg="oklch(0.65 0.20 230 / 0.10)"
                border="oklch(0.65 0.20 230 / 0.30)"
              />
            ))}
          </div>
        </Section>

        <Section title="Tertiary Attributes" accentColor="oklch(0.50 0.01 240)">
          <div className="flex flex-wrap">
            {blueprint.tertiaryAttributes.map((attr) => (
              <TierPill
                key={attr}
                label={attr}
                color="oklch(0.60 0.01 240)"
                bg="oklch(0.18 0.015 240)"
                border="oklch(0.25 0.02 240)"
              />
            ))}
          </div>
        </Section>

        {/* Reasoning */}
        {blueprint.reasoning && (
          <div
            className="mt-2 p-3 rounded-lg border text-xs leading-relaxed"
            style={{
              background: "oklch(0.13 0.012 240)",
              borderColor: "oklch(0.20 0.02 240)",
              color: "oklch(0.55 0.01 240)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <span
              className="text-xs font-bold tracking-wider uppercase block mb-1"
              style={{ color: "oklch(0.45 0.01 240)", fontFamily: "'Rajdhani', sans-serif" }}
            >
              Scout Notes
            </span>
            {blueprint.reasoning}
          </div>
        )}
      </div>
    </div>
  );
}
