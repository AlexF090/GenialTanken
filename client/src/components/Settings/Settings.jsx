import React from 'react';
import styled from 'styled-components';
import Button from '../Button/Button.jsx';

function Settings({ fuelValue, setFuelValue, getCurrentPosition, radius, setRadius }) {
  return (
    <Wrapper>
      <FuelHeader>Kraftstoff</FuelHeader>
      <E5 htmlFor="e5">E5</E5>
      <E5RadioButton
        checked={fuelValue === 'e5'}
        type="radio"
        id="e5"
        name="filter"
        value="e5"
        onChange={() => setFuelValue('e5')}
      />
      <E10 htmlFor="e10">E10</E10>
      <E10RadioButton
        checked={fuelValue === 'e10'}
        type="radio"
        id="e10"
        name="filter"
        value="e10"
        onChange={() => setFuelValue('e10')}
      />
      <Diesel htmlFor="diesel">Diesel</Diesel>
      <DieselRadioButton
        checked={fuelValue === 'diesel'}
        type="radio"
        id="diesel"
        name="filter"
        value="diesel"
        onChange={() => setFuelValue('diesel')}
      />
      <RadiusHeader>Radius: {radius} km</RadiusHeader>
      <RadiusSlider
        type="range"
        min="5"
        max="30"
        step="5"
        value={radius}
        onChange={event => setRadius(Number(event.target.value))}
      />
      <Button
        buttonTitle={'Speichern'}
        myFunction={() => {
          getCurrentPosition();
        }}
      />
    </Wrapper>
  );
}

const Wrapper = styled.main`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 0.25fr 1fr 0.25fr 1fr 0.25fr 1fr 1fr 0.25fr 0.5fr 1fr 0.5fr 1fr 0.5fr;
  grid-template-areas:
    'fuel fuel fuel'
    '. . .'
    'e5 . e5RadioButton'
    '. . .'
    'e10 . e10RadioButton'
    '. . .'
    'diesel . dieselRadioButton'
    '. . .'
    'radiusText radiusText radiusText'
    '. . .'
    'radiusSlider radiusSlider radiusSlider'
    '. . .'
    '. saveButton .'
    '. . .';
  width: 70vw;
  max-width: 768px;
  box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.25), inset 0px 0px 5px rgba(0, 0, 0, 0.25);
  border-radius: 10px;
  padding: 20px;
`;

const E5 = styled.label`
  grid-area: e5;
  align-self: center;
`;

const E10 = styled.label`
  grid-area: e10;
  align-self: center;
`;

const Diesel = styled.label`
  grid-area: diesel;
  align-self: center;
`;

const E5RadioButton = styled.input`
  grid-area: e5RadioButton;
  align-self: center;
  justify-self: end;
`;

const E10RadioButton = styled.input`
  grid-area: e10RadioButton;
  align-self: center;
  justify-self: end;
`;

const DieselRadioButton = styled.input`
  grid-area: dieselRadioButton;
  align-self: center;
  justify-self: end;
`;

const RadiusSlider = styled.input`
  grid-area: radiusSlider;
  align-self: center;
  width: 100%;
`;

const RadiusHeader = styled.h3`
  grid-area: radiusText;
  font-size: 1.5rem;
  text-decoration: underline;
`;

const FuelHeader = styled.h3`
  grid-area: fuel;
  font-size: 1.5rem;
  text-decoration: underline;
`;

export default Settings;
