import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.tsx';

interface RulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Traditional Nepali Call Break Rules</DialogTitle>
          <DialogDescription>
            Four individual players, 52 cards, and Spades (♠) as permanent trump.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm text-[#D1DDD7] leading-relaxed">
          <section className="space-y-1.5">
            <h3 className="font-semibold text-[#F4F1EA]">1. Deal &amp; Turn Order</h3>
            <p>
              Each player receives 13 cards. Play and dealer rotation proceed
              counterclockwise. The player immediately to the dealer&apos;s right
              bids first and leads the first trick.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-[#F4F1EA]">2. Bidding (Calls)</h3>
            <p>
              Before playing, each player declares how many tricks they expect to win
              (default 1–8). Bids are revealed in turn, cannot be changed, and do not
              need to sum to 13. Passing is not allowed.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-[#F4F1EA]">3. Playing &amp; Trumping</h3>
            <ul className="list-disc pl-5 space-y-1 text-[#C5D4CC]">
              <li>
                You must follow the leading suit whenever you hold a card of that suit.
              </li>
              <li>
                When following suit (and no spade has trumped yet), you must beat the
                highest card of that suit already played if possible.
              </li>
              <li>
                If a spade has already trumped a non-spade trick, you must still follow
                the leading suit if you hold it, without needing to beat the spade.
              </li>
              <li>
                If void in the leading suit, you must play a ♠ Spade (and overtrump any
                existing winning spade if possible). If unable to overtrump, you may
                discard any card.
              </li>
              <li>
                Highest ♠ Spade wins any trick containing spades; otherwise the highest
                card of the leading suit wins.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-[#F4F1EA]">4. Fractional Scoring</h3>
            <p>
              Meeting or exceeding your bid earns <span className="font-mono text-[#F4F1EA]">Bid + 0.1 × (Tricks − Bid)</span>.
              Falling short deducts <span className="font-mono text-[#F4F1EA]">−Bid</span>.
            </p>
            <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0B1410]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-[#9EB3A8]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Bid</th>
                    <th className="px-3 py-2 font-medium">Tricks Won</th>
                    <th className="px-3 py-2 font-medium text-right">Round Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 font-mono tabular-nums">
                  <tr>
                    <td className="px-3 py-1.5">3</td>
                    <td className="px-3 py-1.5">3</td>
                    <td className="px-3 py-1.5 text-right text-[#34D399]">+3.0</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5">3</td>
                    <td className="px-3 py-1.5">5</td>
                    <td className="px-3 py-1.5 text-right text-[#34D399]">+3.2</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5">4</td>
                    <td className="px-3 py-1.5">2</td>
                    <td className="px-3 py-1.5 text-right text-[#F87171]">-4.0</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5">5</td>
                    <td className="px-3 py-1.5">6</td>
                    <td className="px-3 py-1.5 text-right text-[#34D399]">+5.1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
