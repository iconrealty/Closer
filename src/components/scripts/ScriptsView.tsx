import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { FOLLOW_UP_SCRIPTS } from '../../data/scripts';
import { FollowUpScript } from '../../types/crm';
import { Copy, Check, MessageSquare, Mail } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface ScriptsViewProps {
  agentName?: string;
  onOpenCompose: (client: any, mode: 'sms' | 'email', prefilledBody?: string) => void;
}

export const ScriptsView: React.FC<ScriptsViewProps> = ({ agentName: agentNameProp, onOpenCompose }) => {
  const { clients } = useCrm();
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0];
  const resolvedAgentName = agentNameProp?.trim() || 'your agent';

  const fillTemplate = (script: FollowUpScript) => {
    if (!selectedClient) {
      return script.template.replace(/{{agentName}}/g, resolvedAgentName);
    }
    const name = selectedClient.name.split(' ')[0];
    const location = selectedClient.locations[0] || 'your target area';
    const criteria = selectedClient.criteriaNotes || 'your home search';
    const price = formatCurrency((selectedClient.targetPriceMin + selectedClient.targetPriceMax) / 2);

    return script.template
      .replace(/{{name}}/g, name)
      .replace(/{{location}}/g, location)
      .replace(/{{criteria}}/g, criteria)
      .replace(/{{price}}/g, price)
      .replace(/{{agentName}}/g, resolvedAgentName);
  };

  const handleCopy = (script: FollowUpScript) => {
    const text = fillTemplate(script);
    navigator.clipboard.writeText(text);
    setCopiedId(script.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendSms = (script: FollowUpScript) => {
    const text = fillTemplate(script);
    if (selectedClient) {
      onOpenCompose(selectedClient, 'sms', text);
    }
  };

  const handleSendEmail = (script: FollowUpScript) => {
    const text = fillTemplate(script);
    if (selectedClient) {
      onOpenCompose(selectedClient, 'email', text);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-4 py-2 sm:py-4 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-olive-900">Battle-Tested Follow-Up Scripts</h1>
          <p className="text-sm text-tan-600 mt-1">
            Proven real estate messaging that gets 60%+ response rates.
          </p>
        </div>

        {/* Dynamic Client Selector */}
        <div className="flex items-center gap-2 bg-cream border border-tan-200 rounded-xl sm:rounded-lg p-2.5 sm:p-2 text-sm sm:text-xs">
          <span className="text-tan-600 font-medium whitespace-nowrap">Personalize:</span>
          <select
            value={selectedClient?.id || ''}
            onChange={(e) => setSelectedClientId(e.target.value)}
            disabled={clients.length === 0}
            className="flex-1 sm:flex-initial min-h-[40px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-2.5 py-1.5 sm:py-1 text-base sm:text-xs text-olive-900 font-semibold focus:outline-none focus:border-olive-700 cursor-pointer disabled:opacity-60"
          >
            {clients.length === 0 ? (
              <option value="">No clients yet (preview)</option>
            ) : (
              clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Script Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FOLLOW_UP_SCRIPTS.map((script) => {
          const filledText = fillTemplate(script);
          const isCopied = copiedId === script.id;

          return (
            <div
              key={script.id}
              className="bg-cream border border-tan-200 rounded-xl sm:rounded-lg p-4 sm:p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base sm:text-sm font-bold text-olive-900">{script.title}</h3>
                  <span className="text-xs text-tan-500 shrink-0">
                    {script.category}
                  </span>
                </div>

                <div className="bg-tan-50 border border-tan-200 rounded-lg sm:rounded-md p-3.5 sm:p-3 text-sm sm:text-xs text-olive-900 font-sans whitespace-pre-wrap leading-relaxed select-all">
                  {filledText}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-tan-100 text-sm sm:text-xs">
                <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                  <button
                    onClick={() => handleSendSms(script)}
                    disabled={!selectedClient}
                    className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-tan-100 hover:bg-tan-200 text-olive-900 rounded-lg sm:rounded transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MessageSquare className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-tan-600" />
                    <span>SMS</span>
                  </button>

                  <button
                    onClick={() => handleSendEmail(script)}
                    disabled={!selectedClient}
                    className="flex-1 sm:flex-initial min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-tan-100 hover:bg-tan-200 text-olive-900 rounded-lg sm:rounded transition-colors font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-tan-600" />
                    <span>Email</span>
                  </button>
                </div>

                <button
                  onClick={() => handleCopy(script)}
                  className={`min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-4 sm:px-3 py-2 sm:py-1.5 rounded-lg sm:rounded transition-colors font-semibold cursor-pointer ${
                    isCopied
                      ? 'bg-olive-700 text-cream'
                      : 'bg-olive-50 text-olive-800 border border-olive-200 hover:bg-olive-100'
                  }`}
                >
                  {isCopied ? <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> : <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
