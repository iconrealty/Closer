import React from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, ClientStage } from '../../types/crm';
import { Avatar } from '../common/Avatar';
import { formatCurrency, getRelativeDaysLabel } from '../../utils/formatters';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface PipelineBoardProps {
  onOpenClient: (client: Client) => void;
}

const STAGES: { key: ClientStage; label: string; desc: string }[] = [
  { key: 'new_lead', label: 'New Lead', desc: 'Uncontacted / Fast response' },
  { key: 'contacted', label: 'Contacted', desc: 'Qualifying & Discovery' },
  { key: 'active_showing', label: 'Active Showing', desc: 'Touring & Writing Offers' },
  { key: 'under_contract', label: 'Under Contract', desc: 'In Escrow / Due Diligence' },
  { key: 'closed', label: 'Closed Deal', desc: 'Funded & Past Client Care' },
  { key: 'long_term_nurture', label: 'Long Nurture', desc: '6+ Month Watchlist' },
];

export const PipelineBoard: React.FC<PipelineBoardProps> = ({ onOpenClient }) => {
  const { clients, updateStage, searchQuery, stats } = useCrm();

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const primaryName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const secName = c.secondaryContact ? `${c.secondaryContact.firstName} ${c.secondaryContact.lastName}`.toLowerCase() : '';
    const secPhone = c.secondaryContact?.phone || '';

    return (
      primaryName.includes(q) ||
      secName.includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      secPhone.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.criteriaNotes.toLowerCase().includes(q) ||
      c.locations.some((l) => l.toLowerCase().includes(q))
    );
  });

  const getStageVolume = (stageKey: ClientStage) => {
    return filteredClients
      .filter((c) => c.stage === stageKey)
      .reduce((sum, c) => {
        if (c.underContractDetails) {
          return sum + c.underContractDetails.contractPrice;
        }
        return sum + (c.targetPriceMin + c.targetPriceMax) / 2;
      }, 0);
  };

  const moveStage = (clientId: string, currentStage: ClientStage, direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = STAGES.findIndex((s) => s.key === currentStage);
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < STAGES.length) {
      updateStage(clientId, STAGES[newIndex].key);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-olive-900">Pipeline Board</h1>
          <p className="text-sm text-tan-600 mt-1">
            Full visibility into deal progression. Move clients through stages with one click.
          </p>
        </div>

        {/* Pipeline & Commission Summary */}
        <div className="flex items-center gap-3 bg-cream border border-tan-200 rounded-lg p-2.5 text-xs self-start sm:self-auto">
          <div>
            <span className="text-[10px] font-semibold text-tan-500 uppercase tracking-wider block">Pipeline Volume</span>
            <span className="font-bold text-olive-900 text-sm tabular-nums">
              {formatCurrency(stats.totalPipelineValue)}
            </span>
          </div>
          <div className="h-7 w-[1px] bg-tan-200" aria-hidden="true" />
          <div>
            <span className="text-[10px] font-semibold text-olive-700 uppercase tracking-wider block">Est. Commission (2%)</span>
            <span className="font-bold text-olive-700 text-sm tabular-nums">
              {formatCurrency(stats.estimatedCommission)}
            </span>
          </div>
        </div>
      </div>

      {/* Horizontal Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-thin">
        {STAGES.map((stage, stageIndex) => {
          const stageClients = filteredClients.filter((c) => c.stage === stage.key);
          const stageVol = getStageVolume(stage.key);
          const stageEstCommission = stageVol * 0.02;

          return (
            <div
              key={stage.key}
              className="w-72 shrink-0 bg-tan-50 border border-tan-200 rounded-lg flex flex-col h-[calc(100vh-210px)] min-h-[500px]"
            >
              {/* Column Header */}
              <div className="p-3 border-b border-tan-200 bg-tan-100/70 rounded-t-lg">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-olive-900">{stage.label}</span>
                  <span className="text-tan-600 tabular-nums bg-cream border border-tan-200 px-1.5 py-0.5 rounded">
                    {stageClients.length}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-tan-600">
                  <span className="truncate pr-2">{stage.desc}</span>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-olive-900 tabular-nums">
                      {formatCurrency(stageVol)}
                    </div>
                    {stageVol > 0 && (
                      <div className="text-[10px] text-olive-700 font-semibold tabular-nums" title="Estimated 2% commission for this stage">
                        ~{formatCurrency(stageEstCommission)} (2%)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Column Cards */}
              <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
                {stageClients.length === 0 ? (
                  <div className="h-24 flex items-center justify-center border border-dashed border-tan-300 rounded text-[11px] text-tan-500">
                    Empty stage
                  </div>
                ) : (
                  stageClients.map((client) => {
                    const rel = getRelativeDaysLabel(client.nextFollowUpDate);
                    const avgPrice = client.underContractDetails
                      ? client.underContractDetails.contractPrice
                      : (client.targetPriceMin + client.targetPriceMax) / 2;

                    return (
                      <div
                        key={client.id}
                        onClick={() => onOpenClient(client)}
                        className="bg-cream border border-tan-200 hover:border-olive-600 rounded-md p-3 transition-colors cursor-pointer space-y-2.5 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={client.name} src={client.avatarUrl} size="sm" />
                            <div className="truncate">
                              <h4 className="text-xs font-semibold text-olive-900 group-hover:text-olive-700 truncate">
                                {client.name}
                              </h4>
                              <span className="text-[11px] text-tan-600 capitalize">
                                {client.type.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-olive-900 tabular-nums shrink-0">
                            {formatCurrency(avgPrice)}
                          </span>
                        </div>

                        {/* Follow-up Indicator */}
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-tan-100 text-tan-600">
                          <div className="flex items-center gap-1.5 truncate">
                            <Clock className={`w-3 h-3 shrink-0 ${rel.isOverdue ? 'text-rust-600' : 'text-tan-400'}`} />
                            <span className={`tabular-nums ${rel.isOverdue ? 'text-rust-600 font-semibold' : ''}`}>
                              {rel.label}
                            </span>
                          </div>
                        </div>

                        {/* Location / Criteria snippet */}
                        {client.locations.length > 0 && (
                          <div className="text-[10px] text-tan-500 truncate">
                            {client.locations.join(', ')}
                          </div>
                        )}

                        {/* Quick 1-Click Move Arrows */}
                        <div className="flex items-center justify-between pt-1 border-t border-tan-100">
                          <button
                            disabled={stageIndex === 0}
                            onClick={(e) => moveStage(client.id, client.stage, 'prev', e)}
                            className="p-1 hover:text-olive-900 hover:bg-tan-100 rounded disabled:opacity-20 disabled:hover:bg-transparent text-tan-500 transition-colors cursor-pointer"
                            title="Move back one stage"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>

                          <span className="text-[10px] text-tan-500 tabular-nums">
                            Stage {stageIndex + 1}/6
                          </span>

                          <button
                            disabled={stageIndex === STAGES.length - 1}
                            onClick={(e) => moveStage(client.id, client.stage, 'next', e)}
                            className="p-1 hover:text-olive-900 hover:bg-tan-100 rounded disabled:opacity-20 disabled:hover:bg-transparent text-tan-500 transition-colors cursor-pointer"
                            title="Advance to next stage"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
