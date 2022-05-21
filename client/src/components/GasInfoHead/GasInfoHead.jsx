import React from 'react';
import styled from 'styled-components';

function GasInfoHead({ gasInfoHead, fuelValue }) {
  return (
    <>
      {gasInfoHead === fuelValue.charAt(0).toUpperCase() + fuelValue.slice(1) ? (
        <FuelFilter>{gasInfoHead}</FuelFilter>
      ) : (
        <></>
      )}
    </>
  );
}

const FuelFilter = styled.h2`
  grid-area: fuelFilter;
  justify-self: center;
  align-self: center;
  width: 3.125rem;
  height: 2.125rem;
  padding-top: 0.5rem;
  border-radius: 50%;
  font-size: 0.8rem;
  color: white;
  text-align: center;
  background: #2196f3;
`;

export default GasInfoHead;
