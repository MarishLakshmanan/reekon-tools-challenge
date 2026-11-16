import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FeedRow } from '@/components/feed-row';
import { StatusMessage } from '@/components/status-message';
import { ThemedText } from '@/components/themed-text';
import { layout } from '@/constants/layout';
import { Spacing } from '@/constants/theme';
import { downloadMeasurementsCsv } from '@/lib/export';
import { reconnect, useLive } from '@/lib/live';
import { useSettings } from '@/lib/settings';

export default function DashboardScreen() {
  const { unit } = useSettings();
  const { status, feed, online } = useLive();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();

  async function exportCsv() {
    setExporting(true);
    setExportError(undefined);
    try {
      await downloadMeasurementsCsv(unit);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layout.content}
      data={feed}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reconnect} />}
      renderItem={({ item }) => <FeedRow item={item} unit={unit} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ThemedText type="smallBold">Online now</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {online.length ? online.map((user) => user.name).join(', ') : 'Nobody'}
          </ThemedText>
          {status !== 'live' && (
            <ThemedText type="small" themeColor="danger">
              Reconnecting…
            </ThemedText>
          )}
          <View style={styles.export}>
            <Button
              title={exporting ? 'Exporting…' : 'Export CSV'}
              disabled={exporting}
              onPress={exportCsv}
            />
          </View>
          {exportError && (
            <ThemedText type="small" themeColor="danger">
              {exportError}
            </ThemedText>
          )}
          <ThemedText type="smallBold" style={styles.feedTitle}>
            Recent measurements
          </ThemedText>
        </View>
      }
      ListEmptyComponent={<StatusMessage loading={status !== 'live'} />}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.two,
  },
  export: {
    marginTop: Spacing.three,
  },
  feedTitle: {
    marginTop: Spacing.three,
  },
});
