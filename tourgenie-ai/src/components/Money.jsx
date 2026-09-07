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
  // tabular-nums here rather than at each call site: money is nearly always
  // in a column — a budget table, an expense list — and proportional digits
  // make those columns ragged, which is the clearest tell that nobody looked
  // at the page.
  return (
    <Wrapper className={`tabular-nums ${className}`}>
      {formatBdt(bdt)}
      {converted && (
        <span className={`ml-1.5 text-ink-600 ${localClassName}`} title={`Indicative rate — 1 ${converted.code} ≈ ৳${(bdt / converted.value || 0).toFixed(2)}`}>
          ≈ {converted.formatted}
        </span>
      )}
    </Wrapper>
  );
}
