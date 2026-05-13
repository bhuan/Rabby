import React from 'react';
import { Checkbox } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReactComponent as RcIconAlert } from '@/ui/assets/sign/tx/alert-currentcolor.svg';

interface Props {
  message: string;
  acknowledged: boolean;
  onChange: (next: boolean) => void;
}

// Surfaces shouldWarnReservedGasLimitTooHigh at the top of the modal instead
// of inside the Advanced Settings popup, and blocks submit until the user
// explicitly acknowledges. The acknowledgement is reset whenever the user
// edits gas limit (parent owns that effect).
export const GasOverspendBanner = ({
  message,
  acknowledged,
  onChange,
}: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-row items-start gap-8 bg-r-orange-light rounded-[8px] border border-rabby-orange-default px-12 py-10 mt-12">
      <RcIconAlert className="w-16 h-16 flex-shrink-0 mt-2 text-r-orange-default" />
      <div className="flex-1">
        <div className="text-r-orange-default text-13 font-medium mb-4">
          {t('page.signTx.gasOverspend.title')}
        </div>
        <div className="text-r-orange-default text-12 mb-8 leading-[16px]">
          {message}
        </div>
        <label className="flex items-center gap-6 cursor-pointer text-r-orange-default text-12">
          <Checkbox
            checked={acknowledged}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{t('page.signTx.gasOverspend.ack')}</span>
        </label>
      </div>
    </div>
  );
};
