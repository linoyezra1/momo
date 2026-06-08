const FLOWERS = [
  { src: "/images/il-invite/flower-1.png", className: "il-flower--a" },
  { src: "/images/floral-corner.png", className: "il-flower--b" },
  { src: "/images/il-invite/flower-1.png", className: "il-flower--c" },
  { src: "/images/pink-sprig-bg.png", className: "il-flower--d" }
];

export default function IlInviteFloral() {
  return (
    <div className="il-invite-floral" aria-hidden="true">
      {FLOWERS.map((flower) => (
        <img key={flower.className} src={flower.src} alt="" className={`il-flower ${flower.className}`} />
      ))}
    </div>
  );
}
