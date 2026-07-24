// Ícono de marca (badge circular YC) usado en el sidebar y donde haga falta el logo chico.
export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" aria-label="YC Systems">
      <circle cx="17" cy="17" r="17" fill="#1e293b" />
      <text x="16" y="23" textAnchor="end" fontFamily="sans-serif" fontSize="15" fontWeight="500" fill="#3B82F6">Y</text>
      <text x="18" y="23" textAnchor="start" fontFamily="sans-serif" fontSize="15" fontWeight="500" fill="#CBD5E1">C</text>
    </svg>
  );
}
