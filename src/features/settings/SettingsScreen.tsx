import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Card, Disclaimer, Screen, Segmented } from '../../components/ui';
import { LANGUAGES, type Language } from '../../domain/types';
import { useAppStore } from '../../store/appStore';

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setLanguage, deleteAll } = useAppStore();

  return (
    <Screen title={t('settings.title')}>
      <Card>
        <Segmented
          name="language"
          legend={t('settings.language')}
          value={i18n.language as Language}
          options={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
          onChange={(l) => {
            void i18n.changeLanguage(l);
            void setLanguage(l);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/onboarding/profile')}>{t('settings.editProfile')}</Button>
          <Button onClick={() => navigate('/targets')}>{t('settings.editTargets')}</Button>
        </div>
      </Card>
      <Disclaimer />
      <Card>
        <Button
          variant="danger"
          onClick={async () => {
            if (!window.confirm(t('settings.deleteConfirm'))) return;
            await deleteAll();
            navigate('/onboarding', { replace: true });
          }}
        >
          {t('settings.deleteAll')}
        </Button>
      </Card>
    </Screen>
  );
}
