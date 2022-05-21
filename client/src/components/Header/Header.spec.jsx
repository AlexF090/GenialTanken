import { render, screen } from '@testing-library/react';
import Header from './Header';
import { BrowserRouter as Router } from 'react-router-dom';

const title = 'GenialTanken';
const fuelValue = 'e10';
const gasInfoHead = fuelValue.charAt(0).toUpperCase() + fuelValue.slice(1);

describe('Header', () => {
  it('renders a title', () => {
    render(
      <Router>
        <Header title={title} fuelValue={fuelValue} gasInfoHead={gasInfoHead} />
      </Router>
    );

    const headerTitle = screen.getByRole('heading', { name: /GenialTanken/i });
    const headerGasInfoHead = screen.getByRole('heading', { name: 'E10' });
    expect(headerTitle).toBeInTheDocument();
    expect(headerGasInfoHead).toBeInTheDocument();
  });
});
