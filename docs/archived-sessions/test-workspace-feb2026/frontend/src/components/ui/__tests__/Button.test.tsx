import React from 'react'; // Add this import
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const Button = ({ label }: { label: string }) => <button>{label}</button>;

test('renders the button with a label', () => {
  render(<Button label="Click me" />);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
