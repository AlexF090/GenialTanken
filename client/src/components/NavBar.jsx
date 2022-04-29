import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import StartIcon from '../icons/start_icon.svg';
import MapIcon from '../icons/map_icon.svg';
import FavoriteIcon from '../icons/favorite_icon.svg';

function NavBar() {
  return (
    <Navigation>
      <NavList role="list">
        <NavigationLink to="/">
          <li>
            <img src={StartIcon} alt="Start Icon" />
            <figcaption>Start</figcaption>
          </li>
        </NavigationLink>
        <NavigationLink to="/map">
          <li>
            <img src={MapIcon} alt="Karten Icon" />
            <figcaption>Karte</figcaption>
          </li>
        </NavigationLink>
        <NavigationLink to="/favorites">
          <li>
            <img src={FavoriteIcon} alt="Favoriten Icon" />
            <figcaption>Favoriten</figcaption>
          </li>
        </NavigationLink>
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
  border-top: 1px solid black;
  background-color: #ffffff;
`;

const NavList = styled.ul`
  width: 100%;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: space-around;
  color: #2196f3;
  list-style: none;
`;

const NavigationLink = styled(NavLink)`
  text-decoration: none;
  color: #2196f3;
  &.active {
    text-decoration: none;
    color: black;
  }
`;

export default NavBar;
