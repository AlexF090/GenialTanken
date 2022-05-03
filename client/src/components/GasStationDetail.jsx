import React from 'react';
import styled from 'styled-components';
import OpeningTimes from './OpeningTimes';

function GasStationDetail({ currentStation }) {
  return (
    <Wrapper>
      <Brand>{currentStation.brand}</Brand>
      <Name>{currentStation.name}</Name>
      <Street>
        {currentStation.street} {currentStation.house_number}
      </Street>
      <Adress>
        {currentStation.post_code} {currentStation.city}
      </Adress>
      <OpeningTimesWrapper>
        <OpeningTimes currentStation={currentStation} />
      </OpeningTimesWrapper>
    </Wrapper>
  );
}

const Wrapper = styled.main`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr 1fr;
  grid-template-areas:
    'brand .'
    'gasStationName .'
    'street .'
    'adress .';
`;

const Brand = styled.p`
  grid-area: brand;
  align-self: center;
`;

const Name = styled.p`
  grid-area: gasStationName;
  align-self: center;
`;

const Street = styled.p`
  grid-area: street;
  font-size: 0.75rem;
  align-self: end;
`;

const Adress = styled.p`
  grid-area: adress;
  font-size: 0.75rem;
`;

const OpeningTimesWrapper = styled.p`
  grid-area: openingTimes;
  font-size: 0.75rem;
`;

export default GasStationDetail;
