import React from 'react';
import styled from 'styled-components';

const OpeningTimes = ({ currentStation }) => {
  const isOpen = currentStation.isOpen;
  const openingDay = currentStation.openingTimes;

  return (
    <>
      <OpenStatus>
        {isOpen ? 'Die Tankstelle ist geöffnet.' : 'Die Tankstelle hat leider gesschlossen.'}
      </OpenStatus>

      <Week>
        <Day>
          Montag:
          <p>
            {openingDay.monday[0].opening} - {openingDay.monday[0].closing}
          </p>
        </Day>

        <Day>
          Dienstag:
          <p>
            {openingDay.tuesday[0].opening} - {openingDay.tuesday[0].closing}
          </p>
        </Day>

        <Day>
          Mittwoch:
          <p>
            {openingDay.wednesday[0].opening} - {openingDay.wednesday[0].closing}
          </p>
        </Day>

        <Day>
          Donnerstag:
          <p>
            {openingDay.thursday[0].opening} - {openingDay.thursday[0].closing}
          </p>
        </Day>

        <Day>
          Freitag:
          <p>
            {openingDay.friday[0].opening} - {openingDay.friday[0].closing}
          </p>
        </Day>

        <Day>
          Samstag:
          <p>
            {openingDay.saturday[0].opening} - {openingDay.saturday[0].closing}
          </p>
        </Day>

        <Day>
          Sonntag:
          <p>
            {openingDay.sunday[0].opening} - {openingDay.sunday[0].closing}
          </p>
        </Day>
      </Week>
    </>
  );
};

const OpenStatus = styled.h2`
  font-weight: bold;
  font-size: 0.9rem;
`;

const Week = styled.ul`
  list-style: none;
`;

const Day = styled.li`
  margin: 0.2em 0;
  font-size: 0.8rem;
  border-top: 1px solid black;
`;

export default OpeningTimes;
