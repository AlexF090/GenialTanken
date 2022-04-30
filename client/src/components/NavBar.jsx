import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
// import StartIcon from '../icons/start_icon.svg';
// import MapIcon from '../icons/map_icon.svg';
// import FavoriteIcon from '../icons/favorite_icon.svg';
// import { BsStarFill, BsStar } from 'react-icons/bs';
import HomeIcon from './icons/HomeIcon.jsx';
import MapIcon from './icons/MapIcon.jsx';
import FavoriteIconActivated from './icons/FavoriteIconActivated.jsx';

function NavBar() {
  return (
    <Navigation>
      <NavList role="list">
        <NavigationLink to="/">
          <li>
            {/* <img src={StartIcon} alt="Start Icon" /> */}
            <HomeIcon />
            <p>Start</p>
          </li>
        </NavigationLink>
        <NavigationLink to="/map">
          <li>
            <MapIcon />
            {/* <img src={MapIcon} alt="Karten Icon" /> */}
            {/* <GrMap size={'3em'} color={'#00ff00'} /> */}
            <p>Karte</p>
          </li>
        </NavigationLink>
        <NavigationLink to="/favorites">
          <li>
            {/* <img src={FavoriteIcon} alt="Favoriten Icon" /> */}
            <FavoriteIconActivated />
            <p>Favoriten</p>
          </li>
        </NavigationLink>
      </NavList>
    </Navigation>
  );
}

const Navigation = styled.nav`
  display: flex;
  flex-wrap: wrap;
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
    color: #0367B4;
    
  }
`;

export default NavBar;
