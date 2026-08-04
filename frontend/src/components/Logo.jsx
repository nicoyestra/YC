import logoHorizontal from "../assets/yc-logo-horizontal.png";

export default function Logo({ showName = false }) {
  return (
    <div className="yc-logo-lockup">
      <img
        src={logoHorizontal}
        alt="YC System"
        className="yc-logo-horizontal"
      />
    </div>
  );
}