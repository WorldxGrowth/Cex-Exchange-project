// Centralized coin logo + avatar helper
export const getCoinLogo = (logoUrl, symbol) => {
  if (logoUrl) return logoUrl;
  return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${symbol?.toLowerCase()}.svg`;
};

export const CoinAvatar = ({ symbol, logoUrl, size = 24 }) => {
  const src = getCoinLogo(logoUrl, symbol);
  return (
    <img
      src={src}
      alt={symbol}
      width={size}
      height={size}
      style={{ borderRadius: '50%', marginRight: 6, verticalAlign: 'middle' }}
      onError={(e) => {
        e.target.src = `https://ui-avatars.com/api/?name=${symbol}&size=${size}&background=f0b90b&color=000`;
      }}
    />
  );
};

export default getCoinLogo;
