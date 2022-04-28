import React from 'react';
import styled from 'styled-components';
import StartIcon from '../icons/start_icon.svg';
import MapIcon from '../icons/map_icon.svg';
import SettingsIcon from '../icons/settings_icon.svg';
import FavoriteIcon from '../icons/favorite_icon.svg';

function NavBar() {
  return (
    <Wrapper>
      <UnorderedList role="list">
        <li>
          <Icon src={StartIcon} alt="Start Icon" />
          <figcaption>Start</figcaption>
        </li>
        <li>
          <Icon src={MapIcon} alt="Karten Icon" />
          <figcaption>Karte</figcaption>
        </li>
        <li>
          <Icon src={SettingsIcon} alt="Einstellungs Icon" />
          <figcaption>Einstellungen</figcaption>
        </li>
        <li>
          <Icon src={FavoriteIcon} alt="Favoriten Icon" />
          <figcaption>Favoriten</figcaption>
        </li>
        <li>
          <Icon src={FavoriteIcon} alt="Favoriten Icon" />
          <figcaption>Favoriten</figcaption>
        </li>
      </UnorderedList>
    </Wrapper>
  );
}

const Wrapper = styled.nav`
  display: flex;
  width: 100%;
  height: 4.6875rem;
  position: fixed;
  bottom: 0;
  border: 1px solid black;
  background-color: #ffffff;
`;

const UnorderedList = styled.ul`
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-evenly;
  color: #2196f3;
  list-style: none;
`;

const Icon = styled.img`
  width: 2rem;
`;

export default NavBar;
