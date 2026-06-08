function CocktailIcon() {
  return (
    <svg className="il-timeline__svg" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M14 30h20v3H14v-3zm4-20c0-2.8 2.2-5 5-5s5 2.2 5 5v7H18V10zm-6 8h32v9c0 5-4 9-9 9H21c-5 0-9-4-9-9V18z"
        fill="currentColor"
      />
    </svg>
  );
}

function RingsIcon() {
  return (
    <svg className="il-timeline__svg" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="18" cy="24" r="9" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="30" cy="24" r="9" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  );
}

export default function IlTimelineIcon({ name, gifSrc }) {
  const Icon = name === "rings" ? RingsIcon : CocktailIcon;

  return (
    <div className="il-timeline__icon-box">
      {gifSrc ? (
        <img
          className="il-timeline__gif"
          src={gifSrc}
          alt=""
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <Icon />
    </div>
  );
}
