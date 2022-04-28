import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import StartIcon from '../icons/start_icon.svg';
import MapIcon from '../icons/map_icon.svg';
import SettingsIcon from '../icons/settings_icon.svg';
import FavoriteIcon from '../icons/favorite_icon.svg';

function NavBar() {
  return (
    <Navigation>
      <NavList role="list">
        <NavLinkStyled to="/">
          <li>
            <img src={StartIcon} alt="Start Icon" />
            <figcaption>Start</figcaption>
            </li>
        </NavLinkStyled>
        <NavLinkStyled to="/Karte">
          <li>
            <img src={MapIcon} alt="Karten Icon" />
            <figcaption>Karte</figcaption>
          </li>
        </NavLinkStyled>
        <NavLinkStyled to="/Einstellungen">
          <li>
            <img src={SettingsIcon} alt="Einstellungs Icon" />
            <figcaption>Einstellungen</figcaption>
          </li>
        </NavLinkStyled>
        <NavLinkStyled to="/Favoriten">
          <li>
            <img src={FavoriteIcon} alt="Favoriten Icon" />
            <figcaption>Favoriten</figcaption>
          </li>
        </NavLinkStyled>
      </NavList>
    </Navigation>
  );
}

const Navigation = styled.nav`
  display: flex;
  width: 100%;
  height: 4.6875rem;
  position: fixed;
  bottom: 0;
  border: 1px solid black;
  background-color: #ffffff;
`;

const NavList = styled.ul`
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-evenly;
  color: #2196f3;
  list-style: none;
`;

const NavLinkStyled = styled(NavLink)`
  text-decoration: none;
  color: #2196F3;
  &.active {
    text-decoration: none;
    color: black;
  }
`;

const Icon = styled.img`
  width: 2rem;
`;

export default NavBar;
