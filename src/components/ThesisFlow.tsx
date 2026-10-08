interface ThesisData {
  id: number;
  research_problem: string;
  objective: string;
  methodology: string;
  key_contributions: string;
  results: string;
  conclusions: string | null;
  future_work: string | null;
}
const chapters = [
  ["research_problem", "Research Problem"],
  ["objective", "Objective"],
  ["methodology", "Methodology"],
  ["key_contributions", "Key Contributions"],
  ["results", "Results"],
  ["conclusions", "Conclusions"],
  ["future_work", "Future Directions"],
] as const;
export default function ThesisFlow({ thesis }: { thesis: ThesisData }) {
  return (
    <div className="thesis-flow">
      {chapters
        .filter(([key]) => thesis[key])
        .map(([key, title], index) => (
          <details className="reading-disclosure" key={key} open={index === 0}>
            <summary>
              <span className="chapter-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{title}</h3>
              <span aria-hidden="true">+</span>
            </summary>
            <p>{thesis[key]}</p>
          </details>
        ))}
    </div>
  );
}
