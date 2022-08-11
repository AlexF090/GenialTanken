import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import HomeIcon from '../icons/navigation/HomeIcon.jsx';
import MapIcon from '../icons/navigation/MapIcon.jsx';
import FavoriteIcon from '../icons/navigation/FavoriteIcon.jsx';

function NavBar() {
  return (
    <Navigation>
      <NavList role="list">
        <li>
          <NavigationLink to="/">
            <HomeIcon />
            <p>Start</p>
          </NavigationLink>
        </li>
        <li>
          <NavigationLink to="/map">
            <MapIcon />
            <p>Karte</p>
          </NavigationLink>
        </li>
        <li>
          <NavigationLink to="/favorites">
            <FavoriteIcon />
            <p>Favoriten</p>
          </NavigationLink>
        </li>
      </NavList>
    </Navigation>
  );
}

const Navigation = styled.nav`
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  height: 6em;
  position: fixed;
  bottom: 0;
  border-top: 1px solid black;
  background-color: #ffffff;
  z-index: 20;
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
    color: #002c76;
  }
`;

export default NavBar;
