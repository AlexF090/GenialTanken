import React from 'react';
import styled from 'styled-components';

function GasInfoHead({ gasInfoHead, fuelValue }) {
  return (
    <>
      {gasInfoHead === fuelValue.charAt(0).toUpperCase() + fuelValue.slice(1) ? (
        <Wrapper>{gasInfoHead}</Wrapper>
      ) : (
        <></>
      )}
    </>
  );
}

const Wrapper = styled.h2`
  position: fixed;
  padding: 0.5em;
  left: 15px;
  top: 30px;
  border-radius: 50%;
  font-size: 1rem;
  color: white;
  text-align: center;
  background: rgb(2, 0, 36);
  background: linear-gradient(
    0deg,
    rgba(2, 0, 36, 1) 0%,
    rgba(3, 103, 180, 1) 39%,
    rgba(33, 150, 243, 1) 100%
  );
`;

export default GasInfoHead;
