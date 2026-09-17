import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('react-leaflet', () => {
  const MockComp = ({ children }) => children || null;
  return {
    MapContainer: MockComp,
    TileLayer: MockComp,
    Marker: () => null,
    Popup: MockComp,
    LayersControl: Object.assign(MockComp, { BaseLayer: MockComp }),
    Circle: () => null,
    useMap: () => ({ flyTo: jest.fn(), setView: jest.fn() })
  };
});

test('renders the secure access screen', () => {
  render(<App />);
  const linkElement = screen.getByText(/SECURE ACCESS/i);
  expect(linkElement).toBeInTheDocument();
});