import logoSrc from "@assets/showgate-logo.png";

interface ShowgateLogoProps {
  size?: number;
}

export function ShowgateLogo({ size = 18 }: ShowgateLogoProps) {
  return (
    <img
      src={logoSrc}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="inline-block object-contain flex-shrink-0"
      style={{ marginLeft: 7, verticalAlign: "middle" }}
    />
  );
}
