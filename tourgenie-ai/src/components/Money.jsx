import { useCurrency } from "../context/CurrencyContext";

// One BDT amount, with the local equivalent alongside it when the trip is
// somewhere that doesn't spend taka.
//
//   <Money bdt={48400} local="THB" />   →  ৳48,400 ≈ ฿13,634
//   <Money bdt={4200} />                →  ৳4,200
//
// The approximately-sign is doing real work: these are indicative reference
// rates, not a live FX feed, and the figure should not be read as a quote.
export default function Money({ bdt, local, className = "", localClassName = "", block = false }) {
  const { formatBdt, convert } = useCurrency();
  const converted = convert(bdt, local);

  const Wrapper = block ? "div" : "span";
  return (
    <Wrapper className={className}>
      {formatBdt(bdt)}
      {converted && (
        <span className={`ml-1.5 text-ink-900/55 ${localClassName}`} title={`Indicative rate — 1 ${converted.code} ≈ ৳${(bdt / converted.value || 0).toFixed(2)}`}>
          ≈ {converted.formatted}
        </span>
      )}
    </Wrapper>
  );
}
