import React, { useState, useCallback } from 'react';
import { Popover, ActionList, DatePicker, Button, BlockStack, InlineStack, Box, Divider, TextField } from '@shopify/polaris';
import { CalendarIcon } from '@shopify/polaris-icons';

export function DateRangePicker({ onApply }: { onApply: (range: string) => void }) {
  const [popoverActive, setPopoverActive] = useState(false);
  const [activePreset, setActivePreset] = useState('Last 7 days');
  
  const [{ month, year }, setDate] = useState({ month: 6, year: 2026 }); // July 2026
  
  const [selectedDates, setSelectedDates] = useState({
    start: new Date('2026-07-18'),
    end: new Date('2026-07-24'),
  });

  const togglePopoverActive = useCallback(
    () => setPopoverActive((popoverActive) => !popoverActive),
    [],
  );

  const handleMonthChange = useCallback(
    (month: number, year: number) => setDate({ month, year }),
    [],
  );

  const handleApply = () => {
    onApply(activePreset);
    setPopoverActive(false);
  };

  const activator = (
    <Button onClick={togglePopoverActive} icon={CalendarIcon}>
      {activePreset}
    </Button>
  );

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      autofocusTarget="none"
      onClose={togglePopoverActive}
      preferredAlignment="right"
      fluidContent
    >
      <InlineStack wrap={false}>
        <Box padding="400" minWidth="150px" borderInlineEndWidth="025" borderColor="border">
          <ActionList
            actionRole="menuitem"
            items={[
              { content: 'Last 7 days', onAction: () => setActivePreset('Last 7 days'), active: activePreset === 'Last 7 days' },
              { content: 'Current month', onAction: () => setActivePreset('Current month'), active: activePreset === 'Current month' },
              { content: 'Last month', onAction: () => setActivePreset('Last month'), active: activePreset === 'Last month' },
              { content: 'Last 3 month', onAction: () => setActivePreset('Last 3 month'), active: activePreset === 'Last 3 month' },
              { content: 'Last 6 month', onAction: () => setActivePreset('Last 6 month'), active: activePreset === 'Last 6 month' },
              { content: 'Custom range', onAction: () => setActivePreset('Custom range'), active: activePreset === 'Custom range' },
            ]}
          />
        </Box>
        <Box padding="400">
          <BlockStack gap="400">
            <InlineStack gap="200" align="center" blockAlign="center">
              <TextField label="Start" labelHidden value={selectedDates.start.toISOString().split('T')[0]} onChange={() => {}} autoComplete="off" />
              <span>→</span>
              <TextField label="End" labelHidden value={selectedDates.end.toISOString().split('T')[0]} onChange={() => {}} autoComplete="off" />
            </InlineStack>
            <DatePicker
              month={month}
              year={year}
              onChange={setSelectedDates}
              onMonthChange={handleMonthChange}
              selected={selectedDates}
              multiMonth
              allowRange
            />
            <Divider />
            <InlineStack align="end" gap="200" blockAlign="center">
              <Button onClick={() => setPopoverActive(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleApply}>Apply</Button>
            </InlineStack>
          </BlockStack>
        </Box>
      </InlineStack>
    </Popover>
  );
}
