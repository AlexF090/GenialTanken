import React from 'react';

function Price({ price }) {
  const fuelPrice = price.toString();
  return (
    <>
      {fuelPrice.substring(0, 4)}
      <sup>{fuelPrice.substring(4, 5)}</sup>
    </>
  );
}
export default Price;
