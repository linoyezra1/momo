import wineIcon from "../../../WINE.png";
import ringIcon from "../../../RING.png";

const ICONS = {
  cocktail: wineIcon,
  reception: wineIcon,
  rings: ringIcon,
  ceremony: ringIcon
};

export default function IlTimelineIcon({ name }) {
  const src = ICONS[name] || wineIcon;
  const alt = name === "rings" || name === "ceremony" ? "חופה וקידושין" : "קבלת פנים";

  return (
    <div className="il-timeline__icon-box">
      <img className="il-timeline__img" src={src} alt={alt} />
    </div>
  );
}
