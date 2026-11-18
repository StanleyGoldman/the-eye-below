// Things people say in the dark. Some are true and some are not, and
// nobody says which. The "truth" field is for the audit and the tests;
// the game never shows it.

export interface Rumor {
  text: string;
  truth: boolean;
}

function t(text: string): Rumor {
  return { text, truth: true };
}

function f(text: string): Rumor {
  return { text, truth: false };
}

export const RUMORS: readonly Rumor[] = [
  t("A floating eye cannot harm anyone who cannot see it."),
  t("Hit a cockatrice with anything but your hands."),
  t("Fire keeps a troll down."),
  t("Holy water lifts a curse from whatever is dipped in it."),
  t("An altar tells blessed from cursed: amber for the one, black for the other."),
  t("A scroll of scare monster does its best work lying on the floor under your feet."),
  t("Pick up a scare monster scroll twice and you are holding dust."),
  t("Read enchant weapon while confused and your blade will never rust."),
  t("The blind cannot be turned to stone by a look."),
  t("A mirror at the throat sends a gaze back where it came from."),
  t("Shopkeepers price a thing by what it is, not by what you think it is."),
  t("Pray when you are nearly dead, and then not again for a long while."),
  t("A cursed potion of gain level raises you, in the wrong sense."),
  t("A cursed scroll of teleportation changes your level, not your place."),
  t("Step back when the ogre raises his club. He is slow to raise it again."),
  t("Anything that heals will stop your limbs turning to stone."),
  t("A long sword, a fountain, and the fifth level of experience. One time in six."),
  t("The stalker is only invisible to those who cannot see the invisible."),
  t("A leprechaun gives the gold back, if you kill it."),
  t("Heavy armor muddles spells."),
  t("The ring of free action laughs at ghouls."),
  t("Levitation crosses a moat as well as any bridge."),
  t("A blessed spellbook never bites its reader."),
  t("The dead run from a word, if you know the word."),
  f("A cockatrice is harmless if you whistle."),
  f("Trolls fear the colour red."),
  f("Fountains grant wishes to the patient."),
  f("A ring of teleportation always takes you to the stairs."),
  f("The oracle lies on Thursdays."),
  f("Rust makes iron armor stronger, down here."),
  f("Floating eyes sleep when it rains."),
  f("Shopkeepers are slow and half blind. An easy mark."),
  f("Praying twice is twice as good."),
  f("Medusa cannot see you if you stand perfectly still."),
  f("The seventh level has no monsters on it."),
  f("A potion of sleeping cures confusion."),
  f("Kobolds carry the key to the Hollow Tower."),
  f("Gold weighs you down. Drop it before a fight."),
  f("Wraiths cannot cross a doorway."),
  f("A cursed sword cuts deeper."),
];
