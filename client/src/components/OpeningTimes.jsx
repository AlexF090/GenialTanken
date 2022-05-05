import React from 'react';
import styled from 'styled-components';

const OpeningTimes = ({ currentStation }) => {
  const isOpen = currentStation.isOpen;
  const openingDay = currentStation.openingTimes;

  return (
    <>
      <h2>{isOpen ? 'Die Tankstelle ist geöffnet.' : 'Die Tankstelle hat leider gesschlossen.'}</h2>
      <ul >
        <Day>
          Montag:
          <time>
            {openingDay.monday[0].opening} - {openingDay.monday[0].closing}
          </time>
        </Day>
        <Day>
          Dienstag:
          <time>
            {openingDay.tuesday[0].opening} - {openingDay.tuesday[0].closing}
          </time>
        </Day>
        <Day>
          Mittwoch:
          <time>
            {openingDay.wednesday[0].opening} - {openingDay.wednesday[0].closing}
          </time>
        </Day>
        <Day>
          Donnerstag:
          <time>
            {openingDay.thursday[0].opening} - {openingDay.thursday[0].closing}
          </time>
        </Day>
        <Day>
          Freitag:
          <time>
            {openingDay.friday[0].opening} - {openingDay.friday[0].closing}
          </time>
        </Day>
        <Day>
          Samstag:
          <time>
            {openingDay.saturday[0].opening} - {openingDay.saturday[0].closing}
          </time>
        </Day>
        <Day>
          Sonntag:
          <time>
            {openingDay.sunday[0].opening} - {openingDay.sunday[0].closing}
          </time>
        </Day>
      </ul>
    </>
  );
};

const Day = styled.li`
  list-style: none;
`;

export default OpeningTimes;
